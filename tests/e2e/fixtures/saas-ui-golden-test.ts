import { expect, test as base } from "@playwright/test";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const test = base.extend({
  goldenRuntimeErrorGate: [
    async ({ page }, use) => {
      const failures: string[] = [];
      const onConsole = (message: { type(): string; text(): string }) => {
        if (message.type() === "error") {
          failures.push(`console.error: ${message.text()}`);
        }
      };
      const onPageError = (error: Error) => {
        failures.push(`pageerror: ${errorMessage(error)}`);
      };
      const onRequestFailed = (request: {
        resourceType(): string;
        url(): string;
        failure(): { errorText?: string } | null;
      }) => {
        if (
          request.resourceType() === "document" ||
          request.resourceType() === "script"
        ) {
          failures.push(
            `failed ${request.resourceType()} request: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
          );
        }
      };
      const onResponse = (response: {
        request(): { resourceType(): string };
        status(): number;
        url(): string;
      }) => {
        if (
          response.request().resourceType() === "document" &&
          response.status() >= 400
        ) {
          failures.push(
            `failed document response: ${response.status()} ${response.url()}`,
          );
        }
      };

      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);

      try {
        await use(undefined);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("requestfailed", onRequestFailed);
        page.off("response", onResponse);
        expect(failures, "browser runtime errors").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
