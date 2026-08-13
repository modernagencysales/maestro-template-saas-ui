import { getUserSettings } from "./get-user-settings";

export async function UserSettings() {
  const userSettings = await getUserSettings();

  // set user settings globally so our `useUserSettings` hook
  // can access it during SSR.
  if (typeof global !== "undefined") {
    const settingsGlobal = global as typeof global & {
      __USER_SETTINGS__?: unknown;
    };
    settingsGlobal.__USER_SETTINGS__ = userSettings;
  }

  return null;
}
