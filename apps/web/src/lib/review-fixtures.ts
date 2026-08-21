export type ReviewContact = Readonly<{
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  avatar: string;
  status: "new" | "active" | "inactive";
  type: "lead" | "customer";
  tags: readonly string[];
  createdAt: string;
  updatedAt: string;
}>;

export const reviewContacts: readonly ReviewContact[] = [
  {
    id: "helmut-magomedov",
    workspaceId: "review-workspace",
    firstName: "Helmut",
    lastName: "Magomedov",
    name: "Helmut Magomedov",
    email: "helmut@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Helmut",
    status: "active",
    type: "customer",
    tags: ["Enterprise"],
    createdAt: "2026-08-01T14:00:00.000Z",
    updatedAt: "2026-08-19T13:42:00.000Z",
  },
  {
    id: "dariusz-thomas",
    workspaceId: "review-workspace",
    firstName: "Dariusz",
    lastName: "Thomas",
    name: "Dariusz Thomas",
    email: "dariusz@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Dariusz",
    status: "new",
    type: "lead",
    tags: ["Product"],
    createdAt: "2026-08-04T09:15:00.000Z",
    updatedAt: "2026-08-19T12:18:00.000Z",
  },
  {
    id: "aisha-njuguna",
    workspaceId: "review-workspace",
    firstName: "Aisha",
    lastName: "Njuguna",
    name: "Aisha Njuguna",
    email: "aisha@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Aisha",
    status: "active",
    type: "customer",
    tags: ["Design"],
    createdAt: "2026-08-07T16:30:00.000Z",
    updatedAt: "2026-08-18T20:25:00.000Z",
  },
  {
    id: "christian-amadi",
    workspaceId: "review-workspace",
    firstName: "Christian",
    lastName: "Amadi",
    name: "Christian Amadi",
    email: "christian@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Christian",
    status: "inactive",
    type: "lead",
    tags: ["Growth"],
    createdAt: "2026-08-09T11:45:00.000Z",
    updatedAt: "2026-08-18T17:10:00.000Z",
  },
];

export const reviewActivities = [
  {
    id: "review-activity-1",
    actorId: "contracts-runtime",
    type: "comment",
    metadata: { comment: "Prepared the account for review." },
    createdAt: "2026-08-19T13:42:00.000Z",
  },
  {
    id: "review-activity-2",
    actorId: "contracts-runtime",
    type: "status",
    metadata: { status: "active" },
    createdAt: "2026-08-18T20:25:00.000Z",
  },
] as const;

export type ReviewNotification = Readonly<{
  id: string;
  subjectId: string;
  contactId: string;
  contact: ReviewContact;
  actor: Readonly<{
    id: string;
    name: string;
    avatar: string;
  }>;
  user: Readonly<{
    id: string;
    name: string;
  }>;
  type: "action" | "comment" | "status" | "tags" | "type" | "update";
  data: Readonly<{
    action?: string;
    comment?: string;
    field?: string;
    status?: string;
    tags?: readonly string[];
    type?: string;
    value?: string;
  }>;
  date: string;
  createdAt: string;
  readAt?: string;
}>;

export const reviewNotifications: readonly ReviewNotification[] =
  reviewContacts.map((contact, index) => ({
    id: `review-notification-${index + 1}`,
    subjectId: contact.id,
    contactId: contact.id,
    contact,
    actor: {
      id: "contracts-runtime",
      name: index === 0 ? "Sarah Miller" : "Alex Morgan",
      avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${index === 0 ? "Sarah" : "Alex"}`,
    },
    user: {
      id: "contracts-runtime",
      name: index === 0 ? "Sarah Miller" : "Alex Morgan",
    },
    type: index === 0 ? "comment" : index === 1 ? "status" : "update",
    data:
      index === 0
        ? { comment: "Prepared the account for review." }
        : index === 1
          ? { status: "active" }
          : { field: "plan", value: "Pro" },
    date: contact.updatedAt,
    createdAt: contact.updatedAt,
    readAt: index > 1 ? contact.updatedAt : undefined,
  }));
