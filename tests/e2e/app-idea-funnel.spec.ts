import { expect, test, type Page } from "@playwright/test";

const answers = [
  "ChairFill helps dental practices fill cancelled appointments.",
  "Independent dental practices with two to ten locations.",
  "Last-minute cancellations leave expensive chair time unused.",
  "Receptionists call waitlisted patients one by one.",
  "Rank and message suitable waitlist patients automatically.",
  "Matches treatment type, travel time, and patient preferences.",
  "I know three practice owners willing to pilot it.",
  "I managed operations for a five-location dental group.",
] as const;

const completeEvaluation = async (page: Page) => {
  for (const answer of answers) {
    await page.getByLabel("Your answer").fill(answer);
    await page
      .getByRole("button", { name: /Save and continue|Evaluating idea/ })
      .click();
  }
};

test("anonymous idea through paid Build Pack and Maestro handoff", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      consoleErrors.push(
        `${page.url()} :: ${message.text()} :: ${location.url}:${String(location.lineNumber ?? 0)}`,
      );
    }
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Roast my app idea" }).first().click();
  await completeEvaluation(page);

  await expect(page.getByText("Your app idea verdict")).toBeVisible();
  await expect(
    page.getByText("What it will take", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get the Complete Build Pack" }).click();
  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Secure test checkout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pay $29.00" }).click();
  await expect(page.getByText("Payment confirmed")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.localStorage)))
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^maestro\.idea-evaluation\.idea_/),
        "maestro.idea-funnel.commerce",
      ]),
    );
  await page.getByRole("link", { name: "Generate my Build Pack" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reportId = window.location.pathname.split("/")[2] ?? "";
        const commerce = JSON.parse(
          window.localStorage.getItem("maestro.idea-funnel.commerce") ?? "{}",
        ) as {
          entitlements?: { reportId: string; status: string }[];
        };
        return {
          evaluationPresent:
            window.localStorage.getItem(
              `maestro.idea-evaluation.${reportId}`,
            ) !== null,
          entitlementStatus:
            commerce.entitlements?.find((item) => item.reportId === reportId)
              ?.status ?? "missing",
        };
      }),
    )
    .toEqual({ evaluationPresent: true, entitlementStatus: "active" });

  await expect(
    page.getByRole("heading", { name: "Your idea is ready to hand off." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "See how Maestro could build this" })
    .click();
  await expect(page.getByText("$29.00 Maestro credit")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("saved reports remain available in the library", async ({ page }) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your app ideas" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open report" })).toBeVisible();
  await page.getByRole("button", { name: "Create share link" }).click();
  await expect(
    page.getByRole("button", { name: "Revoke share link" }),
  ).toBeVisible();
  const shareHref = await page
    .getByRole("link", { name: "Open share link" })
    .getAttribute("href");
  expect(shareHref).toMatch(/^\/share\/share_idea_/);
  const publicPage = await page.context().newPage();
  await publicPage.goto(shareHref ?? "/share/missing");
  await expect(
    publicPage.getByText("Shared Buildability Report"),
  ).toBeVisible();
  await publicPage.close();
  await page.getByRole("button", { name: "Revoke share link" }).click();
  await page.goto(shareHref ?? "/share/missing");
  await expect(
    page.getByText("This shared report is unavailable"),
  ).toBeVisible();
});

test("report deletion removes private data and invalidates the direct route", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  const reportId = page.url().split("/report/")[1]?.split(/[?#]/)[0] ?? "";
  expect(reportId).toMatch(/^idea_/);

  await page.goto("/library");
  await page.getByRole("button", { name: "Delete report" }).click();
  await expect(
    page.getByText("Delete this report and its private answers permanently?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete report" }).click();

  await expect(
    page.getByRole("heading", { name: "No app ideas yet" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.localStorage.getItem(`maestro.idea-evaluation.${id}`),
        reportId,
      ),
    )
    .toBeNull();
  await page.goto(`/report/${reportId}`);
  await expect(
    page.getByRole("heading", { name: "Report not found" }),
  ).toBeVisible();
});

test("delayed payment confirmation recovers without granting entitlement", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(
    "/checkout/return?report_id=idea_delayed&session_id=checkout_delayed",
  );
  await expect(
    page.getByRole("heading", { name: "Confirming your payment" }),
  ).toBeVisible();

  await page.clock.fastForward(60_000);
  await expect(
    page.getByRole("heading", {
      name: "Payment confirmation is taking longer than usual",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check payment status again" }),
  ).toBeVisible();
  await expect(
    page.getByText("You will not be charged again by checking."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const commerce = JSON.parse(
        window.localStorage.getItem("maestro.idea-funnel.commerce") ?? "{}",
      ) as { entitlements?: unknown[] };
      return commerce.entitlements?.length ?? 0;
    }),
  ).toBe(0);
});

test("a refunded purchase cannot start Build Pack generation", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  const reportId = page.url().split("/report/")[1]?.split(/[?#]/)[0] ?? "";
  expect(reportId).toMatch(/^idea_/);
  await page.evaluate((id) => {
    window.localStorage.setItem(
      "maestro.idea-funnel.commerce",
      JSON.stringify({
        checkoutReturns: [],
        entitlements: [
          { reportId: id, paymentId: "payment_refunded", status: "revoked" },
        ],
        maestroCredits: [
          {
            reportId: id,
            paymentId: "payment_refunded",
            amountCents: 2900,
            currency: "USD",
            status: "revoked",
          },
        ],
        processedEventIds: ["refund_1"],
        revokedPaymentIds: ["payment_refunded"],
      }),
    );
  }, reportId);

  await page.goto(`/build-pack/${reportId}/generating`);
  await expect(
    page.getByRole("heading", { name: "Build Pack access is not active" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Turning your idea into a build-ready plan.",
    }),
  ).toHaveCount(0);
});

test("email save verification claims a local report and opens its library", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`${page.url()} :: ${message.text()}`);
    }
  });
  await page.goto("/evaluate");
  await expect(page.getByLabel("Your answer")).toBeVisible();
  // TanStack's Vite SSR client can warn during direct deep-link hydration.
  // Scope this regression guard to interactions after the route is ready.
  consoleErrors.length = 0;
  await completeEvaluation(page);
  await expect(page.getByLabel("Email address")).toBeVisible();
  expect(consoleErrors, "report mount").toEqual([]);

  await page.getByLabel("Email address").fill("founder@example.test");
  await page.getByRole("button", { name: "Email my save link" }).click();
  await page.getByRole("link", { name: "Open test verification link" }).click();

  await expect(
    page.getByRole("heading", { name: "Your report is saved." }),
  ).toBeVisible();
  expect(consoleErrors, "verification mount").toEqual([]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("maestro.idea-funnel.owner-access"),
      ),
    )
    .toMatch(/^owner_/);

  await page.getByRole("link", { name: "Open my library" }).click();
  await expect(page.getByRole("link", { name: "Open report" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("an owner can revise a local report without losing version one", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  await page.getByLabel("Email address").fill("founder@example.test");
  await page.getByRole("button", { name: "Email my save link" }).click();
  await page.getByRole("link", { name: "Open test verification link" }).click();
  await page.getByRole("link", { name: "Open my library" }).click();
  await page.getByRole("link", { name: "Open report" }).click();

  await page
    .getByLabel("What should the report reconsider?")
    .fill(
      "We interviewed three practice owners who need specialist cancellation matching.",
    );
  await page.getByRole("button", { name: "Generate revised report" }).click();

  await expect(page.getByText("Version 2 is ready.")).toBeVisible();
  await expect(page.getByText("2 versions are saved.")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const id = window.location.pathname.split("/").at(-1) ?? "";
        return JSON.parse(
          window.localStorage.getItem(
            `maestro.idea-evaluation.versions.${id}`,
          ) ?? "[]",
        ).length as number;
      }),
    )
    .toBe(2);

  await page.reload();
  await expect(page.getByText("2 versions are saved.")).toBeVisible();
});

test("a recoverable premium checkpoint retries without another purchase", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  const reportId = page.url().split("/report/")[1]?.split(/[?#]/)[0] ?? "";
  const packId = `pack_${reportId}`;
  await page.evaluate(
    ({ id, idPack }) => {
      window.localStorage.setItem(
        "maestro.idea-funnel.commerce",
        JSON.stringify({
          checkoutReturns: [],
          entitlements: [
            { reportId: id, paymentId: "payment_retry", status: "active" },
          ],
          maestroCredits: [],
          processedEventIds: ["payment_retry"],
          revokedPaymentIds: [],
        }),
      );
      window.localStorage.setItem(
        `maestro.idea-funnel.build-pack.${idPack}`,
        JSON.stringify({
          run: {
            packId: idPack,
            reportId: id,
            reportVersion: 1,
            status: "failed-recoverable",
            stages: [
              {
                name: "normalize",
                status: "completed",
                attempts: 1,
                output: "Completed normalize",
              },
              {
                name: "challenge",
                status: "failed-recoverable",
                attempts: 1,
                error: "Fake provider capacity interruption",
              },
              ...[
                "research",
                "design",
                "specify",
                "review",
                "compile",
                "map-to-maestro",
              ].map((name) => ({ name, status: "queued", attempts: 0 })),
            ],
          },
        }),
      );
    },
    { id: reportId, idPack: packId },
  );

  await page.goto(`/build-pack/${reportId}/generating`);
  await expect(
    page.getByRole("heading", { name: "Generation paused safely" }),
  ).toBeVisible();
  await expect(page.getByText(`Support ID: support_${packId}`)).toBeVisible();
  await page.getByRole("button", { name: "Retry generation" }).click();
  await expect(
    page.getByRole("heading", { name: "Your idea is ready to hand off." }),
  ).toBeVisible();
  expect(
    await page.evaluate((idPack) => {
      const stored = JSON.parse(
        window.localStorage.getItem(
          `maestro.idea-funnel.build-pack.${idPack}`,
        ) ?? "{}",
      ) as { run?: { stages?: { attempts: number; output?: string }[] } };
      return {
        completedOutput: stored.run?.stages?.[0]?.output,
        retriedAttempts: stored.run?.stages?.[1]?.attempts,
      };
    }, packId),
  ).toEqual({ completedOutput: "Completed normalize", retriedAttempts: 2 });
});

test("a low-fit idea keeps its portable handoff without a Maestro pitch", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  const reportId = page.url().split("/report/")[1]?.split(/[?#]/)[0] ?? "";
  const packId = `pack_${reportId}`;
  await page.evaluate(
    ({ id, idPack }) => {
      const evaluationKey = `maestro.idea-evaluation.${id}`;
      const evaluation = JSON.parse(
        window.localStorage.getItem(evaluationKey) ?? "{}",
      ) as {
        result?: { dimensions?: { maestroFit?: { score?: number } } };
      };
      if (evaluation.result?.dimensions?.maestroFit) {
        evaluation.result.dimensions.maestroFit.score = 20;
      }
      window.localStorage.setItem(evaluationKey, JSON.stringify(evaluation));
      window.localStorage.setItem(
        `maestro.idea-funnel.build-pack.${idPack}`,
        JSON.stringify({
          run: {
            packId: idPack,
            reportId: id,
            reportVersion: 1,
            status: "completed",
            stages: [],
          },
        }),
      );
    },
    { id: reportId, idPack: packId },
  );

  await page.goto(`/maestro/${packId}`);
  await expect(
    page.getByRole("heading", { name: "Use your Build Pack anywhere." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Give it to a developer, agency or coding agent and they will know what to build.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start building with Maestro" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Return to your Build Pack" }),
  ).toBeVisible();
});
