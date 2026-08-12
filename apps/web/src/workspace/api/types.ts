export type ContactDTO = Record<string, unknown> & {
  id: string;
  name?: string;
  email?: string;
};
export type NotificationDTO = Record<string, unknown> & { id: string };
export type TagDTO = Record<string, unknown> & { id: string; name: string };
export type WorkspaceMemberDTO = Record<string, unknown> & { id: string };
