import { type RegistryItem, parseRegistryItems } from '@saas-ui/registry/schema'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { canonicalRegistryItemContentHash } from './registry-content-hash.js'

const catalogPath = path.resolve(
  import.meta.dirname,
  '..',
  'public',
  'public-catalog.json',
)
const catalog = parseRegistryItems(
  JSON.parse(await readFile(catalogPath, 'utf8')),
  'pinned public registry catalog',
)
const repaired: RegistryItem[] = catalog.map((item) => {
  const registrySource = `https://saas-ui.dev/r/styles/default/${encodeURIComponent(item.name)}.json`
  const normalized = {
    ...item,
    meta: { ...item.meta, registrySource },
  }
  return {
    ...normalized,
    meta: {
      ...normalized.meta,
      contentHash: canonicalRegistryItemContentHash(normalized),
    },
  }
})
const temporaryPath = `${catalogPath}.tmp-${process.pid}`

await writeFile(temporaryPath, `${JSON.stringify(repaired, null, 2)}\n`, 'utf8')
await rename(temporaryPath, catalogPath)
console.log(`Repaired ${repaired.length} pinned public registry hashes.`)
