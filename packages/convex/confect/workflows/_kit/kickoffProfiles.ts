export const kickoffProfileStartOptions = (
  profile: "eager-first-poll" | "queued",
): { readonly startAsync: boolean } => ({
  startAsync: profile === "queued",
});
