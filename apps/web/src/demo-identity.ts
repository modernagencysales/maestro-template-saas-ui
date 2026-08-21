export type DemoIdentity = {
  readonly product: string;
  readonly ref: string;
  readonly mode: string;
  readonly backend: string;
  readonly commit: string;
};

type DemoIdentityEnv = Readonly<Record<string, string | undefined>>;

const valueOr = (input: string | undefined, fallback: string): string =>
  input?.trim() || fallback;

export const resolveDemoIdentity = (env: DemoIdentityEnv): DemoIdentity => ({
  product: valueOr(env.VITE_DEMO_PRODUCT, "Maestro Brain"),
  ref: valueOr(env.VITE_DEMO_REF, "unidentified build"),
  mode: valueOr(env.VITE_DEMO_MODE, "local"),
  backend: valueOr(env.VITE_DEMO_BACKEND, "unverified"),
  commit: valueOr(env.VITE_DEMO_COMMIT, "unknown"),
});

export const demoIdentity = resolveDemoIdentity(import.meta.env);
