import Cookies from "js-cookie";

export function getLastUsedWorkspace() {
  return Cookies.get("last-used-workspace");
}

export function setLastUsedWorkspace(workspace: string) {
  return Cookies.set("last-used-workspace", workspace);
}
