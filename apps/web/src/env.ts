export const isIsolatedContractsRuntime = () =>
  import.meta.env.DEV && import.meta.env.VITE_MAESTRO_CONTRACT_MODE === "1";
