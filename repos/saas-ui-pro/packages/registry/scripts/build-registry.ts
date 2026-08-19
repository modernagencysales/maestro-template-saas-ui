import {
  type AnalyzeItemFilesOptions,
  type ExternalRegistryCatalog,
  type RegistryArtifacts,
  type RegistryCompilerDiagnostic,
  type RegistryDependencyGraph,
  type RegistryTransactionOptions,
  RegistryValidationError,
  analyzeItemFiles,
  assertRegistryValid,
  createEmitRegistryInput,
  createRegistryArtifacts,
  discoverRegistryItems,
  publishRegistryArtifacts,
  resolveDependencyGraph,
  validateRegistry,
} from '@saas-ui/registry/compiler'
import { type RegistryItem, parseRegistryIndex } from '@saas-ui/registry/schema'
import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  canonicalJson,
  canonicalRegistryItemContentHash,
  hashContent,
} from './registry-content-hash.js'

const PRO_DISCOVERY_STYLE = 'default'
const LEGACY_PUBLIC_PATHS = [
  'colors',
  'schema.json',
  'themes',
  'themes.css',
] as const
const LEGACY_PREVIEW_PATHS = ['default'] as const

export interface ProRegistryPaths {
  /** Pro package containing the authored blocks directory. */
  proPackagesRoot: string
  /** Published static registry root. */
  outputDir: string
  /** Generated preview manifest root. */
  previewOutputDir: string
  /** Checked-in public registry catalog and source bundle. */
  publicCatalogPath: string
}

export interface CompileProRegistryOptions {
  aliases?: AnalyzeItemFilesOptions['aliases']
  externalPackages?: readonly string[]
  externalRegistries?: readonly ExternalRegistryCatalog[]
  paths?: ProRegistryPaths
  /** Canonical public endpoint used for cross-registry dependencies. */
  publicRegistryUrl?: string
}

export interface ProRegistryCompilation {
  artifacts: RegistryArtifacts
  diagnostics: readonly RegistryCompilerDiagnostic[]
  /** Pro-only ownership graph used for dependency inference. */
  graph: RegistryDependencyGraph
  /** Pro-only graph serialized by the private registry service. */
  publicationGraph: RegistryDependencyGraph
}

export interface BuildProRegistryOptions extends CompileProRegistryOptions {
  transaction?: RegistryTransactionOptions
}

export function getDefaultProRegistryPaths(): ProRegistryPaths {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  )
  return {
    proPackagesRoot: path.resolve(packageRoot, '..'),
    outputDir: path.join(packageRoot, 'public', 'r'),
    previewOutputDir: path.join(packageRoot, '__registry__'),
    publicCatalogPath: path.join(packageRoot, 'public', 'public-catalog.json'),
  }
}

async function exists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function containsComponentConfig(directory: string): Promise<boolean> {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name, 'en'),
  )) {
    if (entry.isFile() && entry.name === 'component.config.ts') return true
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      (await containsComponentConfig(path.join(directory, entry.name)))
    ) {
      return true
    }
  }
  return false
}

function storybookSegment(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

async function inferStoryPreview(item: {
  sourceDirectory: string
  name: string
}) {
  const entries = await readdir(item.sourceDirectory, { withFileTypes: true })
  const story = entries.find(
    (entry) => entry.isFile() && entry.name.endsWith('.stories.tsx'),
  )
  if (!story) return `blocks-${item.name}--default`

  const source = await readFile(
    path.join(item.sourceDirectory, story.name),
    'utf8',
  )
  const title = /title\s*:\s*['"]([^'"]+)['"]/.exec(source)?.[1]
  if (!title) return `blocks-${item.name}--default`
  return `${title.split('/').map(storybookSegment).join('-')}--default`
}

function attachStorybookPreviews(
  artifacts: RegistryArtifacts,
  previews: ReadonlyMap<string, string>,
): RegistryArtifacts {
  const createArtifact = (
    file: RegistryArtifacts['files'][number],
    content: string,
  ) => ({ ...file, content, sha256: hashContent(content) })
  const attachPreview = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value
    const item = value as Record<string, unknown>
    const preview =
      typeof item.name === 'string' ? previews.get(item.name) : undefined
    return preview ? { ...item, preview } : item
  }

  const contentHashes = { ...artifacts.contentHashes }
  const itemFiles = new Map(
    artifacts.files
      .filter((file) => /^styles\/[^/]+\/[^/]+\.json$/.test(file.path))
      .map((file) => {
        const value = attachPreview(JSON.parse(file.content)) as Record<
          string,
          unknown
        >
        if (typeof value.name !== 'string' || !previews.has(value.name)) {
          return [file.path, file] as const
        }

        const meta = { ...(value.meta as Record<string, unknown> | undefined) }
        delete meta.contentHash
        const contentHash = canonicalRegistryItemContentHash({
          ...value,
          meta,
        } as RegistryItem)
        contentHashes[value.name] = contentHash
        return [
          file.path,
          createArtifact(
            file,
            canonicalJson({ ...value, meta: { ...meta, contentHash } }),
          ),
        ] as const
      }),
  )

  const diagnostics = artifacts.validationReport.diagnostics.filter(
    (diagnostic) =>
      !(
        diagnostic.code === 'preview-default-export-not-renderable' &&
        diagnostic.item &&
        previews.has(diagnostic.item)
      ),
  )
  const validationReport = {
    ...artifacts.validationReport,
    valid: !diagnostics.some(({ severity }) => severity === 'error'),
    errors: diagnostics.filter(({ severity }) => severity === 'error').length,
    warnings: diagnostics.filter(({ severity }) => severity === 'warning')
      .length,
    infos: diagnostics.filter(({ severity }) => severity === 'info').length,
    diagnostics,
    contentHashes,
  }

  return {
    ...artifacts,
    contentHashes,
    validationReport,
    files: artifacts.files.map((file) => {
      if (file.path === 'index.json') {
        const index = JSON.parse(file.content) as unknown[]
        return createArtifact(
          file,
          canonicalJson(
            index.map((value) => {
              const item = attachPreview(value) as Record<string, unknown>
              const contentHash =
                typeof item.name === 'string'
                  ? contentHashes[item.name]
                  : undefined
              if (!contentHash || !item.meta) return item
              return {
                ...item,
                meta: {
                  ...(item.meta as Record<string, unknown>),
                  contentHash,
                },
              }
            }),
          ),
        )
      }
      if (file.path === 'validation-report.json') {
        return createArtifact(file, canonicalJson(validationReport))
      }
      return itemFiles.get(file.path) ?? file
    }),
  }
}

/**
 * Keep the authored Pro root strict: configured block categories and the hook
 * convention are compiler inputs; package barrels, stories and scratch
 * templates at the blocks root are not accidental registry items.
 */
async function createProSourceRoots(paths: ProRegistryPaths) {
  const blocksRoot = path.join(paths.proPackagesRoot, 'blocks')
  const entries = (await readdir(blocksRoot, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name, 'en'),
  )
  const roots: Array<{
    basePath: string
    path: string
    style: string
    type: 'registry:block' | 'registry:hook'
  }> = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const entryPath = path.join(blocksRoot, entry.name)
    if (entry.name === 'hooks') {
      roots.push({
        // Hook payloads must retain their conventional `hooks/` root so the
        // CLI installs them beneath the configured hooks alias. Using the Pro
        // packages root here emitted `blocks/hooks/...`, which duplicated the
        // source layout in clean consumers.
        basePath: blocksRoot,
        path: entryPath,
        style: PRO_DISCOVERY_STYLE,
        type: 'registry:hook',
      })
    } else if (await containsComponentConfig(entryPath)) {
      roots.push({
        basePath: paths.proPackagesRoot,
        path: entryPath,
        style: PRO_DISCOVERY_STYLE,
        type: 'registry:block',
      })
    }
  }

  return roots
}

async function readPublicCatalog(
  paths: ProRegistryPaths,
  baseUrl: string,
): Promise<ExternalRegistryCatalog> {
  const value = JSON.parse(await readFile(paths.publicCatalogPath, 'utf8'))
  return {
    alias: '#registry/default',
    baseUrl,
    index: parseRegistryIndex(value, 'pinned public registry catalog'),
  }
}

/**
 * Compile only Pro-owned sources. Public aliases are resolved from the pinned
 * catalog and never require the public repository to exist on disk.
 */
export async function compileProRegistry(
  options: CompileProRegistryOptions = {},
): Promise<ProRegistryCompilation> {
  const paths = options.paths ?? getDefaultProRegistryPaths()
  const publicCatalog = await readPublicCatalog(
    paths,
    options.publicRegistryUrl ?? 'https://saas-ui.dev/r',
  )
  const discovery = await discoverRegistryItems({
    sourceRoots: await createProSourceRoots(paths),
  })
  const storybookPreviews = new Map(
    await Promise.all(
      discovery.items
        .filter(
          (item) => item.type === 'registry:block' && !item.config.preview,
        )
        .map(
          async (item) => [item.name, await inferStoryPreview(item)] as const,
        ),
    ),
  )
  const analysis = await analyzeItemFiles(discovery, {
    aliases: {
      '#components': path.join(paths.proPackagesRoot, 'blocks'),
      '#hooks': path.join(paths.proPackagesRoot, 'blocks', 'hooks'),
      '#lib': path.join(paths.proPackagesRoot, 'blocks'),
      '#theme': path.join(paths.proPackagesRoot, 'blocks'),
      '#utils': path.join(paths.proPackagesRoot, 'blocks'),
      '@': path.join(paths.proPackagesRoot, 'blocks'),
      ...options.aliases,
    },
    externalRegistries: [publicCatalog, ...(options.externalRegistries ?? [])],
  })
  const graph = resolveDependencyGraph(analysis, {
    externalPackages: options.externalPackages ?? ['react', 'react-dom'],
  })
  const validation = validateRegistry(graph)
  const publicationGraph = { ...graph, diagnostics: validation.diagnostics }
  const publicationValidation = validateRegistry(publicationGraph)
  const input = createEmitRegistryInput(publicationGraph, {
    name: 'saas-ui-pro',
    homepage: 'https://registry.saas-ui.dev',
    diagnostics: publicationValidation.diagnostics,
  })
  // Registry 0.1.0 treats every preview value as a local source module. Pro
  // previews are external Storybook story IDs, so attach them to the emitted
  // registry payload after compiler validation. The shared compiler preserves
  // these IDs natively in its next patch release; keeping this step is harmless
  // and lets the standalone Pro repository build before that release lands.
  const artifacts = attachStorybookPreviews(
    createRegistryArtifacts(input, {
      previewImportPrefix: '#registry/default',
    }),
    storybookPreviews,
  )

  return {
    artifacts,
    diagnostics: publicationValidation.diagnostics,
    graph,
    publicationGraph,
  }
}

interface LegacyBackup {
  backupPath: string
  originalPath: string
}

async function moveLegacyPaths(
  paths: ProRegistryPaths,
  token: string,
): Promise<LegacyBackup[]> {
  const backupRoot = path.join(
    path.dirname(paths.outputDir),
    `.pro-registry-legacy-${token}`,
  )
  const candidates = [
    ...LEGACY_PUBLIC_PATHS.map((relativePath) => ({
      originalPath: path.join(paths.outputDir, relativePath),
      relativePath: path.join('public', relativePath),
    })),
    ...LEGACY_PREVIEW_PATHS.map((relativePath) => ({
      originalPath: path.join(paths.previewOutputDir, relativePath),
      relativePath: path.join('preview', relativePath),
    })),
  ]
  const backups: LegacyBackup[] = []

  try {
    for (const candidate of candidates) {
      if (!(await exists(candidate.originalPath))) continue
      const backupPath = path.join(backupRoot, candidate.relativePath)
      await mkdir(path.dirname(backupPath), { recursive: true })
      await rename(candidate.originalPath, backupPath)
      backups.push({ backupPath, originalPath: candidate.originalPath })
    }
  } catch (error) {
    await restoreLegacyPaths(backups)
    throw error
  }

  return backups
}

async function restoreLegacyPaths(backups: readonly LegacyBackup[]) {
  for (const backup of [...backups].reverse()) {
    if (!(await exists(backup.backupPath))) continue
    await mkdir(path.dirname(backup.originalPath), { recursive: true })
    await rename(backup.backupPath, backup.originalPath)
  }
}

/** Validate first, then publish the public and preview roots transactionally. */
export async function buildProRegistry(options: BuildProRegistryOptions = {}) {
  const paths = options.paths ?? getDefaultProRegistryPaths()
  const compilation = await compileProRegistry({ ...options, paths })
  assertRegistryValid(compilation.artifacts.validationReport)

  const token = randomUUID()
  let backups: LegacyBackup[] = []
  let committed = false
  try {
    await publishRegistryArtifacts(compilation.artifacts, {
      outputDir: paths.outputDir,
      previewImportPrefix: '#registry/default',
      previewOutputDir: paths.previewOutputDir,
      transaction: {
        ...options.transaction,
        onPhase: async (phase) => {
          if (phase === 'locked') {
            backups = await moveLegacyPaths(paths, token)
          }
          await options.transaction?.onPhase?.(phase)
          if (phase === 'committed') committed = true
        },
      },
    })
  } finally {
    if (!committed) await restoreLegacyPaths(backups)
    await rm(
      path.join(path.dirname(paths.outputDir), `.pro-registry-legacy-${token}`),
      { force: true, recursive: true },
    )
  }

  return compilation
}

function isDirectExecution() {
  const script = process.argv[1]
  return Boolean(
    script && pathToFileURL(path.resolve(script)).href === import.meta.url,
  )
}

if (isDirectExecution()) {
  try {
    const { artifacts } = await buildProRegistry()
    const { errors, infos, items, warnings } = artifacts.validationReport
    console.log(
      `Generated ${artifacts.files.length} Pro registry artifacts for ${items} items.`,
    )
    if (warnings || infos) {
      console.warn(
        `Registry diagnostics: ${warnings} warning(s), ${infos} info message(s), ${errors} error(s).`,
      )
    }
  } catch (error) {
    if (error instanceof RegistryValidationError) {
      console.error(error.message)
      process.exitCode = 1
    } else {
      throw error
    }
  }
}
