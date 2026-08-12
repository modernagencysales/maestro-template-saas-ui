export type ContactDTO = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  company?: string;
  status?: "active" | "inactive" | "new";
  type?: "lead" | "customer";
  tags?: string[];
  workspaceId: string;
  createdAt: string;
};
export type NotificationDTO = {
  id: string;
  subjectId: string;
  actorId: string | null;
  createdAt: string;
  readAt?: string | null;
  type?: "comment" | "action" | "update" | "tags" | "type" | "status";
  subject?: { name?: string };
  metadata?: {
    tags?: string[];
    comment?: string;
    action?: string;
    field?: string;
    value?: string;
    type?: string;
    status?: string;
  };
};
export type TagDTO = Record<string, unknown> & {
  id: string;
  name: string;
  color?: string | null;
};
export type WorkspaceMemberDTO = Record<string, unknown> & {
  id: string;
  email?: string;
  roles?: string | string[];
  status?: string;
};
export type WorkspaceDTO = Record<string, unknown> & {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  subscription?: Record<string, unknown>;
};
export type UserDTO = Record<string, unknown> & {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  avatar?: string | null;
};
export type WorkspaceMemberSettingsDTO = {
  channels: Record<string, boolean>;
  topics: Record<string, boolean>;
  newsletters: Record<string, boolean>;
};
