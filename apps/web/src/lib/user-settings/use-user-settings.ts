import { useLocalStorageValue } from "@react-hookz/web";
import Cookies from "js-cookie";
import { z } from "zod";

const settingsSchema = z.object({
  sidebarWidth: z.number().default(280),
  inboxListWidth: z.number().default(280),
  contactsView: z.enum(["list", "board"]).default("board"),
  contactsColumns: z
    .array(z.string())
    .default(["name", "email", "createdAt", "type", "status"]),
  contactsGroupBy: z.string().default("status"),
});

type UserSettings = z.infer<typeof settingsSchema>;

const defaultSettings: UserSettings = {
  sidebarWidth: 280,
  inboxListWidth: 280,
  contactsView: "list",
  contactsColumns: ["name", "email", "createdAt", "type", "status"],
  contactsGroupBy: "status",
};

type SetUserSettings = <Key extends keyof UserSettings>(
  key: keyof UserSettings,
  value: UserSettings[Key],
) => void;

export const useUserSettings = () => {
  const defaultValue = defaultSettings;

  const { value, set } = useLocalStorageValue<UserSettings>("user-settings", {
    defaultValue,
    stringify(data) {
      const settings = JSON.stringify(data);
      Cookies.set("user-settings", settings, {
        expires: 365,
        path: "/",
        sameSite: "lax",
      });
      return settings;
    },
  });

  const setUserSettings: SetUserSettings = (key, value) => {
    set((prev) => settingsSchema.parse({ ...prev, [key]: value }));
  };

  return [value ?? defaultValue, setUserSettings] as const;
};
