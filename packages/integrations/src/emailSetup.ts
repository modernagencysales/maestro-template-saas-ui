export type PostmarkTemplateDefinition = {
  readonly Name: string;
  readonly Alias: string;
  readonly TemplateType: "Standard";
  readonly Subject: string;
  readonly TextBody: string;
  readonly HtmlBody: string;
};

const shell = (content: string): string =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#111827">${content}</div>`;

export const postmarkTemplates = (): readonly PostmarkTemplateDefinition[] => [
  {
    Name: "Workspace invitation",
    Alias: "workspace-invitation",
    TemplateType: "Standard",
    Subject: "You are invited to {{workspace_name}}",
    TextBody: "You are invited to {{workspace_name}}. Open: {{invitation_url}}",
    HtmlBody: shell(
      '<h1>You are invited to {{workspace_name}}</h1><p><a href="{{invitation_url}}">Open your invitation</a></p>',
    ),
  },
  {
    Name: "Notification digest",
    Alias: "notification-digest",
    TemplateType: "Standard",
    Subject: "{{subject}}",
    TextBody: "{{body}}",
    HtmlBody: shell("<h1>{{subject}}</h1><p>{{body}}</p>"),
  },
  {
    Name: "Verify report email",
    Alias: "verify-report-email",
    TemplateType: "Standard",
    Subject: "Verify your email to save your app idea",
    TextBody: "Verify your email: {{destinationUrl}}",
    HtmlBody: shell(
      '<h1>Verify your email</h1><p><a href="{{destinationUrl}}">Verify email</a></p>',
    ),
  },
  {
    Name: "Build Pack ready",
    Alias: "build-pack-ready",
    TemplateType: "Standard",
    Subject: "Your Complete Build Pack is ready",
    TextBody: "Open your Complete Build Pack: {{destinationUrl}}",
    HtmlBody: shell(
      '<h1>Your Complete Build Pack is ready</h1><p><a href="{{destinationUrl}}">Open your Build Pack</a></p>',
    ),
  },
  {
    Name: "Simple broadcast",
    Alias: "simple-broadcast",
    TemplateType: "Standard",
    Subject: "{{subject}}",
    TextBody: "{{text_body}}\n\nUnsubscribe: {{unsubscribe_url}}",
    HtmlBody: shell(
      '<div style="display:none;max-height:0;overflow:hidden">{{preheader}}</div>{{{html_body}}}<hr><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
    ),
  },
];

export const postmarkWebhooks = (input: {
  readonly publicBaseUrl: string;
  readonly username: string;
  readonly password: string;
}) => {
  const definition = (messageStream: "outbound" | "broadcast") => ({
    Url: `${new URL(input.publicBaseUrl).origin}/webhooks/email/postmark`,
    MessageStream: messageStream,
    HttpAuth: { Username: input.username, Password: input.password },
    Triggers: {
      Delivery: { Enabled: true },
      Bounce: { Enabled: true, IncludeContent: false },
      SpamComplaint: { Enabled: true, IncludeContent: false },
      SubscriptionChange: { Enabled: true },
      Open: { Enabled: false, PostFirstOpenOnly: true },
      Click: { Enabled: false },
    },
  });

  return [definition("outbound"), definition("broadcast")] as const;
};
