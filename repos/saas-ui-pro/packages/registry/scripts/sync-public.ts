import {
  type RegistryItem,
  parseRegistryIndex,
  parseRegistryItem,
} from '@saas-ui/registry/schema'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { canonicalRegistryItemContentHash } from './registry-content-hash.js'

const registryUrl =
  process.env.PUBLIC_REGISTRY_URL?.replace(/\/+$/, '') ??
  'https://saas-ui.dev/r'
const outputPath = path.resolve(
  import.meta.dirname,
  '..',
  'public',
  'public-catalog.json',
)

const indexResponse = await fetch(`${registryUrl}/index.json`, {
  cache: 'no-store',
})
if (!indexResponse.ok) {
  throw new Error(
    `Unable to fetch public registry index: ${indexResponse.status}`,
  )
}

const index = parseRegistryIndex(
  await indexResponse.json(),
  'public registry index',
)
const items: RegistryItem[] = []
for (const entry of index.filter((item) => item.private !== true)) {
  const url = `${registryUrl}/styles/default/${encodeURIComponent(entry.name)}.json`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok)
    throw new Error(`Unable to fetch public registry item ${entry.name}`)
  const payload = await response.json()
  const item = parseRegistryItem(payload, `public registry item ${entry.name}`)
  const pinned = {
    ...item,
    meta: {
      ...item.meta,
      registrySource: url,
      registryVersion:
        process.env.PUBLIC_REGISTRY_VERSION ?? 'deployment-current',
    },
  }
  items.push({
    ...pinned,
    meta: {
      ...pinned.meta,
      contentHash: canonicalRegistryItemContentHash(pinned),
    },
  })
}

const temporaryPath = `${outputPath}.tmp-${process.pid}`
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(temporaryPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8')
await rm(outputPath, { force: true })
await rename(temporaryPath, outputPath)
console.log(`Pinned ${items.length} public registry items from ${registryUrl}.`)
