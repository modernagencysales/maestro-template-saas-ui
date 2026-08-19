import type { RegistryItem } from '@saas-ui/registry/schema'
import { createHash } from 'node:crypto'

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'en')
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecord)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, sortRecord(child)]),
  )
}

function uniqueSorted(values: readonly string[] | undefined) {
  return values?.length ? [...new Set(values)].sort(compareText) : undefined
}

function normalizeNewline(value: string) {
  return `${value.replace(/\r\n?/g, '\n').replace(/\n*$/, '')}\n`
}

export function hashContent(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

export function canonicalJson(value: unknown) {
  return `${JSON.stringify(sortRecord(value), null, 2)}\n`
}

/**
 * Keep Pro compatible with the CLI's canonical registry item hash while its
 * currently published consumer entry point only exports the raw hash helper.
 */
export function canonicalRegistryItemContentHash(item: RegistryItem) {
  const meta = item.meta ? { ...item.meta } : undefined
  if (meta) {
    delete meta.contentHash
    const compiler = meta.compiler
    if (compiler && typeof compiler === 'object' && !Array.isArray(compiler)) {
      const normalizedCompiler = {
        ...(compiler as Record<string, unknown>),
      }
      delete normalizedCompiler.contentHash
      if (Object.keys(normalizedCompiler).length) {
        meta.compiler = normalizedCompiler
      } else {
        delete meta.compiler
      }
    }
  }

  const payload: Record<string, unknown> = {
    schemaVersion: item.schemaVersion,
    name: item.name,
    type: item.type,
    files: (item.files ?? [])
      .map((file) => ({
        path: file.path.replaceAll('\\', '/'),
        type: file.type,
        ...(file.content === undefined
          ? {}
          : { content: normalizeNewline(file.content) }),
        ...(file.target ? { target: file.target.replaceAll('\\', '/') } : {}),
      }))
      .sort((left, right) => compareText(left.path, right.path)),
  }

  if (item.version) payload.version = item.version
  if (item.private !== undefined) payload.private = item.private
  if (item.description) payload.description = item.description
  if (item.source) payload.source = item.source
  if (item.dependencies?.length)
    payload.dependencies = uniqueSorted(item.dependencies)
  if (item.devDependencies?.length)
    payload.devDependencies = uniqueSorted(item.devDependencies)
  if (item.registryDependencies?.length)
    payload.registryDependencies = uniqueSorted(item.registryDependencies)
  if (item.tailwind) payload.tailwind = item.tailwind
  if (item.cssVars) payload.cssVars = item.cssVars
  if (item.category) payload.category = item.category
  if (item.categories?.length)
    payload.categories = uniqueSorted(item.categories)
  if (item.subcategory) payload.subcategory = item.subcategory
  if (item.chunks?.length) payload.chunks = item.chunks
  if (meta && Object.keys(meta).length) payload.meta = meta
  if (item.canvas) payload.canvas = item.canvas
  if (item.docs) payload.docs = item.docs

  return hashContent(canonicalJson(payload))
}
