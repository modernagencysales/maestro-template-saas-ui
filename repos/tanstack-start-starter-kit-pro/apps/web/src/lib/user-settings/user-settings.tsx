import { getUserSettings } from './get-user-settings'

export async function UserSettings() {
  const userSettings = await getUserSettings()

  // set user settings globally so our `useUserSettings` hook
  // can access it during SSR.
  if (typeof global !== 'undefined') {
    ;(global as any).__USER_SETTINGS__ = userSettings
  }

  return null
}
