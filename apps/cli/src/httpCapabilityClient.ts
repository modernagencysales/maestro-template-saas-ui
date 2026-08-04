import { cliFailure, formatJsonOutput } from "./result";
import type { CliCapabilityRunner, CliRuntimeConfig } from "./types";

const failureForStatus: Readonly<Record<number, string>> = {
  401: "Capability request unauthorized.\n",
  403: "Capability request forbidden.\n",
  404: "CLI capability route not found.\n",
  422: "Capability request validation failed.\n",
};

export function createHttpCapabilityRunner(input: {
  readonly config: CliRuntimeConfig;
  readonly fetch: typeof globalThis.fetch;
}): CliCapabilityRunner {
  return async (capabilityId, request) => {
    const { apiBaseUrl, apiKey } = input.config;
    if (!apiBaseUrl || !apiKey)
      return cliFailure(
        "CLI capability execution requires MAESTRO_API_BASE_URL and MAESTRO_API_KEY.\n",
      );

    try {
      const response = await input.fetch(
        `${apiBaseUrl.replace(/\/+$/u, "")}/cli/${encodeURIComponent(capabilityId)}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );
      if (!response.ok)
        return cliFailure(
          failureForStatus[response.status] ??
            "CLI capability request failed.\n",
        );
      return {
        exitCode: 0,
        stdout: formatJsonOutput(await response.json()),
        stderr: "",
      };
    } catch {
      return cliFailure("CLI capability request failed.\n");
    }
  };
}
