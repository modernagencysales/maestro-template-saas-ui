export const AGENT_PACK_EXIT_CODES = {
  success: 0,
  findings: 1,
  invalidInvocation: 2,
  blockedMutation: 3,
  unavailableDependency: 4,
  internalDefect: 70,
} as const;

export type AgentPackExitClass = keyof typeof AGENT_PACK_EXIT_CODES;

export type AgentPackExitCode =
  (typeof AGENT_PACK_EXIT_CODES)[AgentPackExitClass];

export function exitCodeFor(exitClass: AgentPackExitClass): AgentPackExitCode {
  return AGENT_PACK_EXIT_CODES[exitClass];
}
