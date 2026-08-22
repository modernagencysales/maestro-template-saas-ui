export function cx(...classNames: Array<string | undefined | null | false>) {
  return classNames.filter(Boolean).join(' ')
}

export function callAll<T extends (...args: any[]) => void>(
  ...functions: Array<T | undefined>
) {
  return (...args: Parameters<T>) => {
    functions.forEach((fn) => fn?.(...args))
  }
}

export function splitProps<T extends Record<string, any>, K extends keyof T>(
  props: T,
  keys: K[],
): [Pick<T, K>, Omit<T, K>] {
  const picked = {} as Pick<T, K>
  const omitted = { ...props }

  keys.forEach((key) => {
    picked[key] = props[key]
    delete omitted[key]
  })

  return [picked, omitted]
}
