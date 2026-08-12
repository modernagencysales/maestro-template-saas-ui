import { useGoldenAdapter } from "../../golden/adapters";

export const useCurrentUser = () => {
  const { currentUser } = useGoldenAdapter();
  return [currentUser] as const;
};
