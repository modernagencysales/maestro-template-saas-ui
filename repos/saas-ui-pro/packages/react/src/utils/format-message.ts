export const formatMessage = (
  message: string,
  values: Record<string, string | number>,
) => {
  return message.replace(/{([^}]+)}/g, (match, key) => {
    return String(values[key] ?? match)
  })
}
