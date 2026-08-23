export type ContactStatus = "new" | "active" | "inactive";
export type ContactType = "lead" | "customer";
export type MemberRole = "viewer" | "editor" | "admin" | "owner";
export type MemberStatus = "active" | "suspended" | "invited";
export type MemberPresence = "online" | "offline" | "busy" | "dnd" | "away";

export interface TagDTO {
  id: string;
  name: string;
  color: string | null;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface WorkspaceMemberDTO extends UserDTO {
  roles: MemberRole[];
  status: MemberStatus;
  presence?: MemberPresence;
}

export interface WorkspaceSubscriptionDTO {
  accountId: string | null;
  planId: string;
  status:
    | "active"
    | "canceled"
    | "past_due"
    | "trialing"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  startedAt: Date;
  trialEndsAt: Date | null;
  cancelAt: Date | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

export interface WorkspaceDTO {
  id: string;
  slug: string;
  name: string;
  logo?: string | null;
  tags: TagDTO[];
  members: WorkspaceMemberDTO[];
  subscription: WorkspaceSubscriptionDTO;
}

export interface ContactDTO {
  id: string;
  workspaceId: string;
  name: string | null;
  email: string;
  avatar: string | null;
  status: ContactStatus;
  type: ContactType;
  tags: string[] | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NotificationMetadata {
  tags?: string[];
  comment?: string;
  action?: string;
  field?: string;
  value?: string;
  type?: string;
  status?: string;
}

export interface NotificationDTO {
  id: string;
  subjectId: string;
  actorId: string | null;
  readAt: Date | null;
  createdAt: Date;
  type: string | null;
  subject?: Pick<ContactDTO, "name">;
  metadata: NotificationMetadata | null;
}

export interface WorkspaceMemberSettingsDTO {
  channels?: {
    email?: boolean;
    desktop?: boolean;
  };
  topics?: {
    contacts_new_lead?: boolean;
    contacts_account_upgraded?: boolean;
    inbox_assigned_to_me?: boolean;
    inbox_mentioned?: boolean;
  };
  newsletters?: {
    product_updates?: boolean;
    important_updates?: boolean;
  };
}

export interface StarterRouterInputs {
  contacts: {
    listByType: { workspaceId: string; type?: ContactType };
    byId: { workspaceId: string; id: string };
  };
  workspaces: { bySlug: { slug: string } };
}

export interface StarterRouterOutputs {
  contacts: {
    listByType: { contacts: ContactDTO[] };
    byId: ContactDTO;
  };
  notifications: { inbox: { notifications: NotificationDTO[] } };
  workspaces: { bySlug: WorkspaceDTO | null };
}

export type AppRouter = {
  inputs: StarterRouterInputs;
  outputs: StarterRouterOutputs;
};
export type RouterInputs = StarterRouterInputs;
export type RouterOutputs = StarterRouterOutputs;
