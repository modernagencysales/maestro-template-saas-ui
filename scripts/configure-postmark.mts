import {
  postmarkTemplates,
  postmarkWebhooks,
} from "@maestro-template/integrations";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const token = requireEnv("POSTMARK_SERVER_TOKEN");
const publicBaseUrl = requireEnv("TEMPLATE_PUBLIC_BASE_URL");
const username = requireEnv("POSTMARK_WEBHOOK_USERNAME");
const password = requireEnv("POSTMARK_WEBHOOK_PASSWORD");

const request = async (
  path: string,
  init: Omit<RequestInit, "headers"> = {},
): Promise<Record<string, unknown>> => {
  const response = await fetch(`https://api.postmarkapp.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (
    !response.ok ||
    (typeof payload.ErrorCode === "number" && payload.ErrorCode !== 0)
  ) {
    throw new Error(
      typeof payload.Message === "string"
        ? payload.Message
        : `Postmark returned ${String(response.status)}.`,
    );
  }
  return payload;
};

const existingTemplates = await request("/templates?count=100&offset=0");
const templates = Array.isArray(existingTemplates.Templates)
  ? existingTemplates.Templates
  : [];
for (const template of postmarkTemplates()) {
  const exists = templates.some(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "Alias" in value &&
      value.Alias === template.Alias,
  );
  await request(
    exists ? `/templates/${encodeURIComponent(template.Alias)}` : "/templates",
    {
      method: exists ? "PUT" : "POST",
      body: JSON.stringify(template),
    },
  );
  process.stdout.write(
    `${exists ? "Updated" : "Created"} Postmark template: ${template.Alias}.\n`,
  );
}

for (const definition of postmarkWebhooks({
  publicBaseUrl,
  username,
  password,
})) {
  const current = await request(
    `/webhooks?messageStream=${definition.MessageStream}`,
  );
  const webhooks = Array.isArray(current.Webhooks) ? current.Webhooks : [];
  const existing = webhooks.find(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "Url" in value &&
      value.Url === definition.Url &&
      "MessageStream" in value &&
      value.MessageStream === definition.MessageStream,
  ) as { readonly ID?: unknown } | undefined;
  const id = typeof existing?.ID === "number" ? String(existing.ID) : undefined;
  await request(id === undefined ? "/webhooks" : `/webhooks/${id}`, {
    method: id === undefined ? "POST" : "PUT",
    body: JSON.stringify(definition),
  });
  process.stdout.write(
    `${id === undefined ? "Created" : "Updated"} ${definition.MessageStream} webhook.\n`,
  );
}

process.stdout.write(
  "Postmark templates and authenticated webhooks are configured.\n",
);
