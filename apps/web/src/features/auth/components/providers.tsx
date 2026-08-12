import { Button, Stack } from "@chakra-ui/react";
import { useLocalStorageValue } from "@react-hookz/web";
import { useAuth } from "@saas-ui/auth-provider";
import { FaGithub } from "react-icons/fa6";

import { LastUsedProvider } from "./last-used";

export function Providers() {
  const auth = useAuth();

  const lastUsed = useLocalStorageValue("lastUsedProvider");

  return (
    <Stack gap="2" mb="4">
      <LastUsedProvider value="github">
        <Button
          variant="outline"
          onClick={() =>
            auth
              .logIn({
                provider: "github",
              })
              .then(() => lastUsed.set("github"))
          }
        >
          <FaGithub /> Continue with Github
        </Button>
      </LastUsedProvider>
    </Stack>
  );
}
