import { describe, expect, it } from "vitest";
import { openNodeReadinessServer, renderReadinessHtml } from "./server.js";
import { presentBuildReadiness } from "./presenter.js";

const view = presentBuildReadiness({
  app: {
    name: "Customer <App>",
    firstOutcome: "Create & read one record",
    demoOnly: false,
  },
  blueprint: { id: "saas-application", workflowSelected: false },
  recipe: null,
  preflight: {
    worksNow: "Fake records work now.",
    demoOnly: "Live providers are not configured.",
    safeToStart: true,
    diagnostics: [],
  },
  providers: [{ id: "convex", posture: "sample" }],
  providerEnvironments: [
    {
      environment: "dev",
      providers: [{ id: "convex", state: "unavailable", evidence: [] }],
    },
  ],
  surfaces: [{ id: "fake-record-crud", kind: "data", status: "fake" }],
  receipt: null,
});

describe("readiness visual", () => {
  it("renders plain-language sections with technical posture under details", () => {
    const html = renderReadinessHtml(view);

    expect(html).toContain("Customer &lt;App&gt; Build Readiness");
    expect(html).toContain("What works now");
    expect(html).toContain("Screens");
    expect(html).toContain("Data");
    expect(html).toContain("Connections");
    expect(html).not.toContain(">Automations<");
    expect(html.indexOf("<details")).toBeLessThan(
      html.indexOf("fake-record-crud"),
    );
    expect(html).toContain("Provider environments");
    expect(html).toContain("convex=<code>unavailable</code>");
    expect(html).not.toMatch(/secret-value|deploy-key-value/i);
  });
});

describe("readiness server", () => {
  it("serves only HTML over loopback and closes cleanly", async () => {
    const session = await openNodeReadinessServer({ view, port: 0 });
    try {
      expect(session.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const response = await fetch(session.url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("Build Readiness");

      const mutation = await fetch(new URL("execute", session.url), {
        method: "POST",
      });
      expect(mutation.status).toBe(405);
    } finally {
      await session.close();
    }
    await expect(fetch(session.url)).rejects.toThrow();
  });
});
