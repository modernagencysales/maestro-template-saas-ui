import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";

import {
  buildRequestMiddleware,
  resolveWebAuthMode,
} from "./lib/auth/runtime-auth";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});
export const startInstance = createStart(() => ({
  requestMiddleware: buildRequestMiddleware({
    mode: resolveWebAuthMode(process.env),
    csrf: csrfMiddleware,
    createWorkos: authkitMiddleware,
  }),
}));
