import {
  type RegistryClient,
  createRegistryClient,
  hashContent,
  installRegistryItems,
  isRegistryUrl,
  resolveConfigPaths,
  resolveRegistryGraph,
} from '@saas-ui/cli/consumer'
import {
  type RegistryIndexItem,
  type RegistryItem,
  isRegistryItemTypeInstallable,
} from '@saas-ui/cli/consumer'
import type {
  DependencyInstallRequest,
  DependencyInstaller,
} from '@saas-ui/cli/consumer'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
export const REGISTRY_PACKAGE_ROOT = path.resolve(testDirectory, '../..')
export const REPOSITORY_ROOT = path.resolve(REGISTRY_PACKAGE_ROOT, '../..')
export const PRO_BLOCKS_ROOT = path.join(REPOSITORY_ROOT, 'packages', 'blocks')
export const PRO_REGISTRY_ROOT = path.join(REGISTRY_PACKAGE_ROOT, 'public/r')
export const PUBLIC_CATALOG_PATH = path.join(
  REGISTRY_PACKAGE_ROOT,
  'public/public-catalog.json',
)

const PUBLIC_REGISTRY_ORIGIN = 'https://saas-ui.dev'
const PUBLIC_REGISTRY_PATH = '/r/'

const aliases = {
  components: '@/components',
  ui: '@/components/ui',
  lib: '@/lib',
  utils: '@/lib/utils',
  hooks: '@/hooks',
  icons: '@/components/icons',
} as const

function isWithin(root: string, target: string) {
  const relative = path.relative(root, target)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8')) as unknown
}

/**
 * Resolve the exact generated Pro payloads and their canonical absolute public
 * dependencies without a network fallback. This is the same RegistryClient
 * contract used by CLI add/diff/update.
 */
export function createGeneratedProRegistryClient(): RegistryClient {
  return createRegistryClient(async (resource) => {
    const root = PRO_REGISTRY_ROOT
    const relative = resource

    if (isRegistryUrl(resource)) {
      const url = new URL(resource)
      assert.equal(
        url.origin,
        PUBLIC_REGISTRY_ORIGIN,
        `Unexpected external registry origin: ${url.origin}`,
      )
      assert(
        url.pathname.startsWith(PUBLIC_REGISTRY_PATH),
        `Unexpected public registry path: ${url.pathname}`,
      )
      const name = path.basename(url.pathname, '.json')
      const catalog = (await readJson(PUBLIC_CATALOG_PATH)) as RegistryItem[]
      const item = catalog.find((entry) => entry.name === name)
      assert(item, `Pinned public registry item is missing: ${name}`)
      return item
    }

    const target = path.resolve(root, relative)
    assert(
      isWithin(root, target),
      `Registry resource escapes its generated root: ${resource}`,
    )
    try {
      return await readJson(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `Generated registry resource is missing: ${path.relative(
            REGISTRY_PACKAGE_ROOT,
            target,
          )}. Generate both registries before running this fixture.`,
        )
      }
      throw error
    }
  })
}

function packageName(declaration: string) {
  const value = declaration.trim()
  if (value.startsWith('@')) {
    const slash = value.indexOf('/')
    const version = value.indexOf('@', slash + 1)
    return version === -1 ? value : value.slice(0, version)
  }
  const version = value.indexOf('@')
  return version === -1 ? value : value.slice(0, version)
}

function importedPackageName(specifier: string) {
  const segments = specifier.split('/')
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0]!
}

async function manifest(file: string) {
  return (await readJson(file)) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

let workspacePackagesPromise: Promise<Map<string, string>> | undefined

async function workspacePackages() {
  workspacePackagesPromise ??= (async () => {
    const packages = new Map<string, string>()
    const parentDirectories = [path.join(REPOSITORY_ROOT, 'packages')]

    for (const parent of parentDirectories) {
      if (!existsSync(parent)) continue
      const entries = (await fs.readdir(parent, { withFileTypes: true })).sort(
        (left, right) => left.name.localeCompare(right.name, 'en'),
      )
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
        const packageRoot = path.join(parent, entry.name)
        const packageJson = path.join(packageRoot, 'package.json')
        if (!existsSync(packageJson)) continue
        const { name } = (await readJson(packageJson)) as { name?: unknown }
        if (typeof name !== 'string') continue
        const previous = packages.get(name)
        assert(
          !previous || previous === packageRoot,
          `Duplicate workspace package ${name}: ${previous} and ${packageRoot}.`,
        )
        packages.set(name, packageRoot)
      }
    }
    return packages
  })()
  return workspacePackagesPromise
}

/**
 * Prefer the current workspace package over package-local node_modules copies.
 * Pro blocks can retain an older published dependency for Storybook, but the
 * generated consumer must validate the registry against this checkout.
 */
export async function findConsumerDependency(name: string) {
  const workspacePackage = (await workspacePackages()).get(name)
  if (workspacePackage) return workspacePackage

  for (const root of [
    path.join(PRO_BLOCKS_ROOT, 'node_modules'),
    path.join(REGISTRY_PACKAGE_ROOT, 'node_modules'),
    path.join(REPOSITORY_ROOT, 'node_modules'),
  ]) {
    const candidate = path.join(root, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`Clean-consumer dependency ${name} is not installed.`)
}

async function dependencyVersions() {
  const sources = await Promise.all([
    manifest(path.join(PRO_BLOCKS_ROOT, 'package.json')),
    manifest(path.join(REGISTRY_PACKAGE_ROOT, 'package.json')),
    manifest(path.join(REPOSITORY_ROOT, 'package.json')),
  ])
  const versions = new Map<string, string>()
  for (const source of sources.reverse()) {
    for (const [name, version] of Object.entries({
      ...source.devDependencies,
      ...source.dependencies,
    })) {
      versions.set(name, version)
    }
  }
  for (const [name, packageRoot] of await workspacePackages()) {
    const { version } = (await readJson(
      path.join(packageRoot, 'package.json'),
    )) as { version?: unknown }
    if (typeof version === 'string') versions.set(name, version)
  }
  return versions
}

async function createFixtureManifest(payloads: Iterable<RegistryItem>) {
  const required = new Set<string>([
    'next',
    'react',
    'react-dom',
    '@types/node',
    '@types/react',
    '@types/react-dom',
    'typescript',
  ])
  for (const item of payloads) {
    for (const declaration of [
      ...(item.dependencies ?? []),
      ...(item.devDependencies ?? []),
    ]) {
      required.add(packageName(declaration))
    }
  }

  const versions = await dependencyVersions()
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}
  for (const name of [...required].sort()) {
    const version = versions.get(name)
    assert(version, `No clean-consumer version is declared for ${name}.`)
    assert.doesNotMatch(
      version,
      /^(?:workspace|file|link|portal):/,
      `Clean-consumer dependency ${name} uses workspace-only version ${version}.`,
    )
    const target =
      name === 'typescript' || name.startsWith('@types/')
        ? devDependencies
        : dependencies
    target[name] = version
  }

  return {
    name: 'saas-ui-pro-generated-consumer',
    private: true,
    scripts: { build: 'next build', typecheck: 'tsc --noEmit' },
    dependencies,
    devDependencies,
  }
}

async function writeProjectFiles(
  cwd: string,
  payloads: Iterable<RegistryItem>,
) {
  await fs.mkdir(path.join(cwd, 'src/app'), { recursive: true })
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    `${JSON.stringify(await createFixtureManifest(payloads), null, 2)}\n`,
  )
  await fs.writeFile(
    path.join(cwd, 'components.json'),
    `${JSON.stringify(
      { system: 'chakra', style: 'default', rsc: true, tsx: true, aliases },
      null,
      2,
    )}\n`,
  )
  await fs.writeFile(
    path.join(cwd, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['dom', 'dom.iterable', 'esnext'],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: false,
          plugins: [{ name: 'next' }],
          baseUrl: '.',
          paths: { '@/*': ['./src/*'] },
        },
        include: [
          'next-env.d.ts',
          'src/**/*.ts',
          'src/**/*.tsx',
          '.next/types/**/*.ts',
        ],
        exclude: ['node_modules'],
      },
      null,
      2,
    )}\n`,
  )
  await fs.writeFile(
    path.join(cwd, 'next-env.d.ts'),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
  )
  await fs.writeFile(
    path.join(cwd, 'next.config.mjs'),
    'export default { reactStrictMode: true }\n',
  )
  await fs.writeFile(
    path.join(cwd, 'src/app/layout.tsx'),
    `import type { ReactNode } from 'react'\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>\n}\n`,
  )
  await fs.writeFile(
    path.join(cwd, 'src/app/page.tsx'),
    `export default function Page() {\n  return <main>Generated Pro registry consumer</main>\n}\n`,
  )
}

export interface ProConsumerFixture {
  cwd: string
  client: RegistryClient
  index: RegistryIndexItem[]
  payloads: Map<string, RegistryItem>
  selectedItems: string[]
  install: Awaited<ReturnType<typeof installRegistryItems>>
  dependencyRequests: DependencyInstallRequest[]
  dependencyInstaller: DependencyInstaller
}

export async function installProConsumerFixture(cwdInput: string) {
  const cwd = path.resolve(cwdInput)
  const report = (await readJson(
    path.join(PRO_REGISTRY_ROOT, 'validation-report.json'),
  )) as { valid?: unknown; items?: unknown; errors?: unknown[] }
  assert.equal(
    report.valid,
    true,
    'The generated Pro registry validation report is not green.',
  )

  const client = createGeneratedProRegistryClient()
  const index = await client.getIndex()
  const selectedItems = index
    .filter((entry) => isRegistryItemTypeInstallable(entry.type))
    .map((entry) => entry.name)
    .sort()
  assert.equal(
    selectedItems.length,
    index.length,
    'The Pro index contains a non-installable published entry.',
  )
  const graph = await resolveRegistryGraph(selectedItems, 'default', client)
  const payloads = new Map(graph.items.map((item) => [item.name, item]))

  await fs.rm(cwd, { force: true, recursive: true })
  await fs.mkdir(cwd, { recursive: true })
  await writeProjectFiles(cwd, payloads.values())
  const config = await resolveConfigPaths(cwd, {
    system: 'chakra',
    style: 'default',
    rsc: true,
    tsx: true,
    aliases,
  })
  const dependencyRequests: DependencyInstallRequest[] = []
  const dependencyInstaller: DependencyInstaller = async (request) => {
    dependencyRequests.push({
      cwd: request.cwd,
      dependencies: [...request.dependencies],
      devDependencies: [...request.devDependencies],
    })
  }
  const install = await installRegistryItems(selectedItems, config, {
    client,
    dependencyInstaller,
    silent: true,
  })
  return {
    cwd,
    client,
    index,
    payloads,
    selectedItems,
    install,
    dependencyRequests,
    dependencyInstaller,
  } satisfies ProConsumerFixture
}

async function sourceFiles(cwd: string) {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(target)
    }
  }
  await visit(path.join(cwd, 'src'))
  return files.sort()
}

function importedModules(source: string) {
  return [
    ...[...source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1]!,
    ),
    ...[...source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1]!,
    ),
  ]
}

function localImportExists(cwd: string, specifier: string) {
  const base = path.join(cwd, 'src', specifier.slice(2))
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ].some(existsSync)
}

export async function assertProConsumerFixture(result: ProConsumerFixture) {
  assert(result.index.length > 0, 'The generated Pro registry is empty.')
  assert.equal(result.install.applied, true)
  assert.equal(result.install.plan.conflicts.length, 0)
  assert.deepEqual(
    result.install.plan.items
      .filter((item) => result.selectedItems.includes(item.name))
      .map((item) => item.name)
      .sort(),
    result.selectedItems,
  )
  assert.deepEqual(result.dependencyRequests, [])

  const config = (await readJson(path.join(result.cwd, 'components.json'))) as {
    installed?: string[]
  }
  assert.deepEqual(config.installed, result.selectedItems)

  for (const file of result.install.plan.files) {
    const target = path.join(result.cwd, file.target)
    assert.equal(hashContent(await fs.readFile(target)), file.hash)
  }

  const packageJson = (await readJson(
    path.join(result.cwd, 'package.json'),
  )) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  const declared = new Set([
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies),
  ])
  for (const version of [
    ...Object.values(packageJson.dependencies),
    ...Object.values(packageJson.devDependencies),
  ]) {
    assert.doesNotMatch(version, /^(?:workspace|file|link|portal):/)
  }

  for (const file of await sourceFiles(result.cwd)) {
    const source = await fs.readFile(file, 'utf8')
    const relative = path.relative(result.cwd, file)
    assert.doesNotMatch(source, /@saas-ui\/(?:react|core)(?:\/|['"])/)
    assert.doesNotMatch(source, /(?:@\/|#)registry\//)
    assert.doesNotMatch(source, /(?:^|['"])(?:\.\.\/)+(?:apps|packages)\//m)
    assert.doesNotMatch(source, /workspace:/)
    for (const specifier of importedModules(source)) {
      assert.doesNotMatch(
        specifier,
        /^#/,
        `${relative} retains source-only alias ${specifier}.`,
      )
      if (specifier.startsWith('@/')) {
        assert(
          localImportExists(result.cwd, specifier),
          `${relative} imports missing clean-consumer file ${specifier}.`,
        )
      }
      if (
        specifier.startsWith('.') ||
        specifier.startsWith('@/') ||
        specifier.startsWith('#')
      ) {
        assert.doesNotMatch(specifier, /(?:\.d)?\.(?:ts|tsx|mts|cts)$/)
        continue
      }
      const name = importedPackageName(specifier)
      assert(
        declared.has(name),
        `${relative} imports undeclared clean-consumer package ${name}.`,
      )
    }
  }
}

export async function reinstallProConsumerFixture(result: ProConsumerFixture) {
  const before = await snapshotProject(result.cwd)
  const config = await resolveConfigPaths(result.cwd, {
    system: 'chakra',
    style: 'default',
    rsc: true,
    tsx: true,
    aliases,
  })
  const second = await installRegistryItems(result.selectedItems, config, {
    client: result.client,
    dependencyInstaller: result.dependencyInstaller,
    silent: true,
  })
  assert(second.plan.files.every((file) => file.action === 'unchanged'))
  assert.deepEqual(await snapshotProject(result.cwd), before)
}

async function listFiles(root: string) {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.next' || entry.name === 'node_modules') continue
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(target)
      else files.push(target)
    }
  }
  await visit(root)
  return files.sort()
}

export async function snapshotProject(cwd: string) {
  const snapshot: Record<string, string> = {}
  for (const file of await listFiles(cwd)) {
    snapshot[path.relative(cwd, file).split(path.sep).join('/')] = createHash(
      'sha256',
    )
      .update(await fs.readFile(file))
      .digest('hex')
  }
  return snapshot
}

export async function createTemporaryConsumerDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'saas-ui-pro-consumer-'))
}

export async function removeConsumerDirectory(cwd: string) {
  await fs.rm(cwd, { force: true, recursive: true })
}
