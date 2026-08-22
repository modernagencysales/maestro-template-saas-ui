export function runIfFn<T, Args extends unknown[]>(
  valueOrFunction: T | ((...args: Args) => T),
  ...args: Args
): T {
  if (typeof valueOrFunction !== 'function') return valueOrFunction
  return Reflect.apply(valueOrFunction, undefined, args) as T
}
