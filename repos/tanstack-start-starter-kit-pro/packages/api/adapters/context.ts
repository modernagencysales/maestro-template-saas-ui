import { AsyncLocalStorage } from 'async_hooks'

import type { BillingAdapter } from './billing'

export interface AdapterContext {
  adapters: {
    billing?: BillingAdapter
  }
}

const asyncLocalStorage = new AsyncLocalStorage<AdapterContext>()

/**
 * Get the adapters context
 */
export function getAdapterContext(): AdapterContext {
  const context = asyncLocalStorage.getStore()
  if (!context) {
    throw new Error('Adapter context not initialized')
  }
  return context
}

/**
 * Get an adapter from the adapters context
 */
export function useAdapter<K extends keyof AdapterContext['adapters']>(
  name: K,
): NonNullable<AdapterContext['adapters'][K]> {
  const adapter = getAdapterContext().adapters[name]
  if (!adapter) {
    throw new Error(`Adapter ${name} not available`)
  }
  return adapter
}

/**
 * Run a function with the adapters context
 */
export function withAdapters<T>(
  context: AdapterContext,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(context, fn)
}
