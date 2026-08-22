export const closest = <T extends HTMLElement = HTMLElement>(
  target: HTMLElement | EventTarget,
  selector: string,
): T | null => {
  const el = target as HTMLElement
  if (el.matches(selector)) {
    return el as T
  }
  return el.closest(selector) as T | null
}

export const matches = (
  target: HTMLElement | EventTarget,
  selector: string,
) => {
  return (target as HTMLElement).matches(selector)
}
