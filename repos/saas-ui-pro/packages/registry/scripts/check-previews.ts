import { parseRegistryIndex } from '@saas-ui/registry/schema'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const registryRoot = path.resolve(import.meta.dirname, '..')
const registryIndex = parseRegistryIndex(
  JSON.parse(
    await readFile(
      path.join(registryRoot, 'public', 'r', 'index.json'),
      'utf8',
    ),
  ),
  'generated Pro registry index',
)
const storybookRoot = path.resolve(
  process.env.STORYBOOK_OUTPUT_DIR ??
    path.join(registryRoot, '..', 'storybook', 'storybook-static'),
)
const storybookIndex = JSON.parse(
  await readFile(path.join(storybookRoot, 'index.json'), 'utf8'),
) as { entries?: Record<string, unknown>; stories?: Record<string, unknown> }
const entries = storybookIndex.entries ?? storybookIndex.stories ?? {}
const previews = registryIndex
  .filter((item) => item.type === 'registry:block' && item.preview)
  .map((item) => item.preview!)
const missing = previews.filter((preview) => !entries[preview])
const duplicates = previews.filter(
  (preview, index) => previews.indexOf(preview) !== index,
)

if (missing.length || duplicates.length) {
  const messages = [
    ...(missing.length ? [`missing stories: ${missing.join(', ')}`] : []),
    ...(duplicates.length
      ? [`duplicate previews: ${[...new Set(duplicates)].join(', ')}`]
      : []),
  ]
  throw new Error(
    `Pro Storybook preview contract failed: ${messages.join('; ')}`,
  )
}

console.log(`Validated ${previews.length} Pro registry Storybook previews.`)
