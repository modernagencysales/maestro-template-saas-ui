import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  type ProRegistryPaths,
  buildProRegistry,
  compileProRegistry,
} from './build-registry.js'

const temporaryRoots: string[] = []

async function write(filename: string, content: string) {
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, content, 'utf8')
}

async function createFixture(options: { forbidden?: boolean } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'saas-ui-pro-registry-'))
  temporaryRoots.push(root)
  const proPackagesRoot = path.join(root, 'packages')
  const blockDirectory = path.join(
    proPackagesRoot,
    'blocks',
    'cards',
    'pro-card',
  )

  await write(
    path.join(proPackagesRoot, 'registry', 'public-catalog.json'),
    JSON.stringify([
      {
        name: 'button',
        type: 'registry:ui',
        files: ['ui/button/button.tsx'],
      },
    ]),
  )
  await write(
    path.join(proPackagesRoot, 'blocks', 'hooks', 'use-pro-state.ts'),
    `import { useState } from 'react'\nexport const useProState = () => useState(false)\n`,
  )
  await write(
    path.join(blockDirectory, 'component.config.ts'),
    `export default {
  private: true,
  version: '1.0.0',
}\n`,
  )
  await write(
    path.join(blockDirectory, 'pro-card.tsx'),
    options.forbidden
      ? `import { AppShell } from '@saas-ui/react'\nexport default function ProCard() { return AppShell }\n`
      : `import { Box } from '@chakra-ui/react'
import { useProState } from '#hooks/use-pro-state'
import { Button } from '#registry/default/ui/button/button'

export default function ProCard() {
  useProState()
  return Button ?? Box
}\n`,
  )
  await write(
    path.join(blockDirectory, 'pro-card.stories.tsx'),
    `export default { title: 'ProCard' }\n`,
  )
  await write(
    path.join(blockDirectory, 'pro-card.test.tsx'),
    `throw new Error('tests are development-only')\n`,
  )
  await write(
    path.join(blockDirectory, 'pro-card.types.test-d.ts'),
    `export type ProCardTypeTest = true\n`,
  )

  const paths: ProRegistryPaths = {
    outputDir: path.join(root, 'registry-package', 'public', 'r'),
    previewOutputDir: path.join(root, 'registry-package', '__registry__'),
    proPackagesRoot,
    publicCatalogPath: path.join(
      proPackagesRoot,
      'registry',
      'public-catalog.json',
    ),
  }
  return { blockDirectory, paths, root }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe('Pro shared registry compiler', () => {
  it('resolves public aliases through the external registry catalog', async () => {
    const { paths } = await createFixture()
    const first = await compileProRegistry({ paths })
    const second = await compileProRegistry({ paths })
    const item = first.graph.items.find(({ name }) => name === 'pro-card')

    expect(first.artifacts.validationReport.valid).toBe(true)
    expect(first.artifacts.validationReport.infos).toBe(0)
    expect(
      first.artifacts.files.every(
        (file) =>
          file.sha256 ===
          createHash('sha256').update(file.content).digest('hex'),
      ),
    ).toBe(true)
    expect(item?.registryDependencies).toEqual([
      'https://saas-ui.dev/r/styles/default/button.json',
      'use-pro-state',
    ])
    expect(item?.dependencies).toEqual(['@chakra-ui/react'])
    expect(item?.metadata.private).toBe(true)
    expect(item?.files.map((file) => path.basename(file.path))).toEqual([
      'pro-card.tsx',
    ])
    expect(first.publicationGraph.items.map(({ name }) => name).sort()).toEqual(
      ['pro-card', 'use-pro-state'],
    )
    expect(
      first.publicationGraph.items.find(({ name }) => name === 'button'),
    ).toBeUndefined()
    expect(
      first.artifacts.files.find(
        ({ path }) => path === 'styles/default/use-pro-state.json',
      )?.content,
    ).toContain('"path": "hooks/use-pro-state.ts"')
    const emittedProCard = JSON.parse(
      first.artifacts.files.find(
        ({ path }) => path === 'styles/default/pro-card.json',
      )!.content,
    )
    expect(emittedProCard).toMatchObject({
      preview: 'pro-card--default',
      version: '1.0.0',
    })
    expect(emittedProCard.meta.contentHash).toBe(
      first.artifacts.contentHashes['pro-card'],
    )
    expect(
      JSON.parse(
        first.artifacts.files.find(
          ({ path }) => path === 'styles/default/use-pro-state.json',
        )!.content,
      ),
    ).not.toHaveProperty('version')
    expect(
      JSON.parse(
        first.artifacts.files.find(({ path }) => path === 'index.json')!
          .content,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'pro-card',
          preview: 'pro-card--default',
        }),
        expect.objectContaining({ name: 'use-pro-state' }),
      ]),
    )
    expect(first.artifacts.files).toEqual(second.artifacts.files)
    expect(first.artifacts.validationReport).toEqual(
      second.artifacts.validationReport,
    )
  })

  it('fails closed when an installable Pro block imports a forbidden package', async () => {
    const { paths } = await createFixture({ forbidden: true })
    await write(path.join(paths.outputDir, 'index.json'), 'last-known-good\n')
    await write(path.join(paths.outputDir, 'schema.json'), 'legacy-schema\n')

    const compilation = await compileProRegistry({ paths })

    expect(compilation.artifacts.validationReport.valid).toBe(false)
    expect(compilation.artifacts.validationReport.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'forbidden-template-package',
          item: 'pro-card',
          severity: 'error',
        }),
      ]),
    )
    await expect(buildProRegistry({ paths })).rejects.toThrow(
      'Registry validation failed',
    )
    await expect(
      readFile(path.join(paths.outputDir, 'index.json'), 'utf8'),
    ).resolves.toBe('last-known-good\n')
    await expect(
      readFile(path.join(paths.outputDir, 'schema.json'), 'utf8'),
    ).resolves.toBe('legacy-schema\n')
  })

  it('publishes transactionally and removes managed and legacy stale output', async () => {
    const { paths } = await createFixture()
    await write(
      path.join(paths.outputDir, 'styles', 'default', 'stale-item.json'),
      '{}\n',
    )
    await write(path.join(paths.outputDir, 'schema.json'), '{}\n')
    await write(path.join(paths.outputDir, 'themes.css'), 'stale\n')
    await write(
      path.join(paths.previewOutputDir, 'default', 'old-preview.tsx'),
      'stale\n',
    )

    const result = await buildProRegistry({ paths })

    expect(result.artifacts.validationReport.valid).toBe(true)
    await expect(
      readFile(path.join(paths.outputDir, 'validation-report.json'), 'utf8'),
    ).resolves.toContain('"valid": true')
    await expect(
      readFile(
        path.join(paths.outputDir, 'schema', 'registry-item.json'),
        'utf8',
      ),
    ).resolves.toContain('"x-registry-schema-version"')
    await expect(
      readFile(
        path.join(paths.outputDir, 'styles', 'default', 'stale-item.json'),
        'utf8',
      ),
    ).rejects.toThrow()
    await expect(
      readFile(path.join(paths.outputDir, 'schema.json'), 'utf8'),
    ).rejects.toThrow()
    await expect(
      readFile(path.join(paths.outputDir, 'themes.css'), 'utf8'),
    ).rejects.toThrow()
    await expect(
      readFile(
        path.join(paths.previewOutputDir, 'default', 'old-preview.tsx'),
        'utf8',
      ),
    ).rejects.toThrow()
    await expect(readdir(path.dirname(paths.outputDir))).resolves.not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\.pro-registry-legacy-/),
      ]),
    )
  })
})
