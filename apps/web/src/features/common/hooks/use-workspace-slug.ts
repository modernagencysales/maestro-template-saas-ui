import React from "react";

/**
 * Get the current workspace from params
 * The value is stored in a cookie
 *
 * @returns {string} The current workspace slug
 */
export const useWorkspaceSlug = () => {
  const pathname =
    typeof window === "undefined" ? "/acme" : window.location.pathname;
  const workspace = pathname.split("/")[1] || "acme";
  React.useEffect(() => undefined, [workspace]);
  return workspace;
};
