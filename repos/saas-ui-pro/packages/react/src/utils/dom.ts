export const cx = (...classNames: Array<string | undefined | null | false>) =>
  classNames.filter(Boolean).join(' ')

export const dataAttr = (condition: boolean | undefined) =>
  condition ? '' : undefined

export function callAll<T extends (...args: any[]) => void>(
  ...handlers: Array<T | undefined>
) {
  return (...args: Parameters<T>) => {
    handlers.forEach((handler) => handler?.(...args))
  }
}
