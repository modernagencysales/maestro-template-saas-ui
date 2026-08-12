export const authClient = {
  useSession: () => ({ data: null }),
  signIn: { email: async () => undefined },
  signUp: { email: async () => undefined },
  signOut: async () => undefined,
};
