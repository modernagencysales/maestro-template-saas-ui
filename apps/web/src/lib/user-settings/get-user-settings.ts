import Cookies from "js-cookie";

export const USER_SETTINGS_COOKIE = "user-settings";

export const getUserSettings = async function getUserSettings() {
  const userSettingsCookie = Cookies.get(USER_SETTINGS_COOKIE);

  if (!userSettingsCookie) {
    return null;
  }

  return JSON.parse(userSettingsCookie);
};
