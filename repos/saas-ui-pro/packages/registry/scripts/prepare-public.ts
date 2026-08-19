import { parseRegistryItems } from '@saas-ui/registry/schema'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const catalogPath = path.join(packageRoot, 'public', 'public-catalog.json')
const sourceRoot = path.join(packageRoot, 'public', 'source')
const stageRoot = `${sourceRoot}.stage-${process.pid}`

const catalog = parseRegistryItems(
  JSON.parse(await readFile(catalogPath, 'utf8')),
  'pinned public registry catalog',
)

await rm(stageRoot, { force: true, recursive: true })
await mkdir(stageRoot, { recursive: true })

for (const item of catalog) {
  for (const file of item.files ?? []) {
    if (typeof file === 'string' || !file.content) continue
    const relative = file.path.replaceAll('\\', '/')
    if (
      !relative ||
      relative.startsWith('/') ||
      relative.split('/').some((segment) => segment === '..' || segment === '.')
    ) {
      throw new Error(`Unsafe public registry source path: ${file.path}`)
    }
    const target = path.join(stageRoot, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.content, 'utf8')
  }
}

await rm(sourceRoot, { force: true, recursive: true })
await rename(stageRoot, sourceRoot)
console.log(`Prepared ${catalog.length} pinned public registry items.`)
