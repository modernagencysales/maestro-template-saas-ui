import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";

import { buildAuthKitRuntimeConfig } from "./auth/authkit-server";
import { getServerEnv } from "./server-env";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const workosRequestMiddleware = () => {
  const config = buildAuthKitRuntimeConfig(getServerEnv());

  if (config.mode === "fake") return [];

  return [authkitMiddleware({ redirectUri: config.redirectUri })];
};

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, ...workosRequestMiddleware()],
}));
