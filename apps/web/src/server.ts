import {
  createStartHandler,
  defaultRenderHandler,
} from "@tanstack/react-start/server";

export default { fetch: createStartHandler(defaultRenderHandler) };
