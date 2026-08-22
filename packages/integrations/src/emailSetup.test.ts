import { describe, expect, it } from "vitest";

import { postmarkTemplates, postmarkWebhooks } from "./emailSetup";

describe("Postmark setup definitions", () => {
  it("defines every transactional and broadcast template alias", () => {
    expect(postmarkTemplates().map((template) => template.Alias)).toEqual([
      "workspace-invitation",
      "notification-digest",
      "verify-report-email",
      "build-pack-ready",
      "simple-broadcast",
    ]);
  });

  it("creates authenticated outbound and broadcast webhooks without content", () => {
    const definitions = postmarkWebhooks({
      publicBaseUrl: "https://app.example.com/path",
      username: "postmark",
      password: "secret",
    });
    expect(definitions.map((definition) => definition.MessageStream)).toEqual([
      "outbound",
      "broadcast",
    ]);
    expect(definitions[0]).toMatchObject({
      Url: "https://app.example.com/webhooks/email/postmark",
      HttpAuth: { Username: "postmark", Password: "secret" },
      Triggers: {
        Bounce: { Enabled: true, IncludeContent: false },
        SpamComplaint: { Enabled: true, IncludeContent: false },
      },
    });
  });
});
