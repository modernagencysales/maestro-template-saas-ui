export type AssistantMessage = Readonly<{
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  createdAt: number
}>

export type StarterSearchResult = Readonly<{
  id: string
  title: string
  description: string
}>

export const projectAssistantMessagesToSearchResults = (
  messages: readonly AssistantMessage[],
): StarterSearchResult[] =>
  messages
    .filter(({ role }) => role === 'assistant')
    .map(({ id, content }) => ({
      id,
      title: 'Maestro',
      description: content,
    }))

export const askMaestroPromptFixtures = [
  'What needs my attention today?',
  'Summarize the latest client decisions',
  'Which client context is getting stale?',
] as const

export const fakeAskMaestroResult = (
  question: string,
): StarterSearchResult[] => [
  {
    id: 'fixture-maestro-answer',
    title: 'Maestro',
    description: `I would review the Agency Brain and connected client context for “${question}”. In live mode, this answer runs through the governed assistant contract.`,
  },
]
