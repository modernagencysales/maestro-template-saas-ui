export const shouldPersistBrainMarkdown = (input: {
  fixtureRuntime: boolean
  loadedMarkdown: string | undefined
  draftMarkdown: string
}): boolean =>
  !input.fixtureRuntime &&
  input.loadedMarkdown !== undefined &&
  input.draftMarkdown !== input.loadedMarkdown
