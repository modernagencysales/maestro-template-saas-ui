export function safeReturnPath(value: string | null | undefined): string {
  const hasControlCharacter = [...(value ?? "")].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter
  )
    return "/";
  return value;
}
