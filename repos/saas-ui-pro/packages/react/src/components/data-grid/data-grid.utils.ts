export const escapeId = (id: string) => id.replaceAll(/[\s.]/g, '-')

export const getResult = <Data extends object>(
  fn: (row: Data) => string,
  params: Data,
): string => {
  if (typeof fn === 'function') {
    return fn(params)
  }
  return fn
}
