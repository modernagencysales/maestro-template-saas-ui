import {
  assertRegistryValid,
  publishRegistryArtifacts,
} from '@saas-ui/registry/compiler'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { compileProRegistry } from './build-registry.js'

interface Snapshot {
  content: Buffer
  path: string
}

async function snapshotDirectory(
  root: string,
  directory = root,
): Promise<Snapshot[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const snapshots = await Promise.all(
    entries.map(async (entry): Promise<Snapshot[]> => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return snapshotDirectory(root, absolute)
      if (!entry.isFile()) return []
      return [
        {
          content: await readFile(absolute),
          path: path.relative(root, absolute).split(path.sep).join('/'),
        },
      ]
    }),
  )
  return snapshots
    .flat()
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

async function compareDirectories(expected: string, actual: string) {
  const [expectedFiles, actualFiles] = await Promise.all([
    snapshotDirectory(expected),
    snapshotDirectory(actual),
  ])
  const expectedByPath = new Map(
    expectedFiles.map((file) => [file.path, file.content]),
  )
  const actualByPath = new Map(
    actualFiles.map((file) => [file.path, file.content]),
  )
  const paths = [
    ...new Set([...expectedByPath.keys(), ...actualByPath.keys()]),
  ].sort((left, right) => left.localeCompare(right, 'en'))

  return paths.flatMap((filePath) => {
    const expectedContent = expectedByPath.get(filePath)
    const actualContent = actualByPath.get(filePath)
    if (!expectedContent) return [`unexpected ${filePath}`]
    if (!actualContent) return [`missing ${filePath}`]
    return expectedContent.equals(actualContent) ? [] : [`changed ${filePath}`]
  })
}

const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), 'saas-ui-pro-registry-'),
)
const firstOutput = path.join(temporaryRoot, 'first', 'public', 'r')
const firstPreview = path.join(temporaryRoot, 'first', '__registry__')
const secondOutput = path.join(temporaryRoot, 'second', 'public', 'r')
const secondPreview = path.join(temporaryRoot, 'second', '__registry__')

try {
  const build = async (outputDir: string, previewOutputDir: string) => {
    const compilation = await compileProRegistry()
    assertRegistryValid(compilation.artifacts.validationReport)
    await publishRegistryArtifacts(compilation.artifacts, {
      outputDir,
      previewImportPrefix: '#registry/default',
      previewOutputDir,
    })
    return compilation
  }
  const [compilation] = await Promise.all([
    build(firstOutput, firstPreview),
    build(secondOutput, secondPreview),
  ])
  const [publicDrift, previewDrift] = await Promise.all([
    compareDirectories(firstOutput, secondOutput),
    compareDirectories(firstPreview, secondPreview),
  ])
  const drift = [
    ...publicDrift.map((entry) => `public/r: ${entry}`),
    ...previewDrift.map((entry) => `__registry__: ${entry}`),
  ]
  if (drift.length) {
    throw new Error(
      `Pro registry generation is nondeterministic:\n${drift
        .map((entry) => `- ${entry}`)
        .join('\n')}`,
    )
  }
  console.log(
    `Validated ${compilation.artifacts.files.length} Pro registry artifacts ` +
      `for ${compilation.artifacts.validationReport.items} items; two clean builds are byte-for-byte identical.`,
  )
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
