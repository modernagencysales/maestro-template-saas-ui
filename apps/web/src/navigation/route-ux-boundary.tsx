import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@saas-ui/react";
import { describeRouteAnnouncement } from "./route-announcements";
import { useBrowserNetworkState, type WebNetworkState } from "./network-state";
import { activeTemplateRouteKey } from "./workspace";

export function RouteFocusBoundary({
  announcement,
  children,
  focusKey,
  networkAction,
  networkState,
  targetId = "workspace-main",
}: {
  readonly announcement: string;
  readonly children: ReactNode;
  readonly focusKey: string;
  readonly networkAction?: () => void;
  readonly networkState: WebNetworkState;
  readonly targetId?: string;
}) {
  const previousFocusKey = useRef(focusKey);

  useEffect(() => {
    if (previousFocusKey.current === focusKey) return;
    previousFocusKey.current = focusKey;
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }, [focusKey, targetId]);

  return (
    <>
      <a className="template-skip-link" href={`#${targetId}`}>
        Skip to main content
      </a>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="template-live-region"
      >
        {announcement}
      </div>
      {networkState === "online" ? null : (
        <div className="template-network-banner" role="status">
          <span>
            {networkState === "offline"
              ? "You are offline. Check your connection and try again."
              : "The connection is degraded. Some updates may be delayed."}
          </span>
          {networkAction ? (
            <Button onClick={networkAction} size="xs" variant="outline">
              Retry now
            </Button>
          ) : null}
        </div>
      )}
      {children}
    </>
  );
}

export function WebRouteUxBoundary({
  children,
  href,
  pathname,
}: {
  readonly children: ReactNode;
  readonly href: string;
  readonly pathname: string;
}) {
  const [hash, setHash] = useState("");
  const networkState = useBrowserNetworkState();
  const retryCurrentRoute = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  if (activeTemplateRouteKey(pathname) !== null) {
    return children;
  }

  return (
    <RouteFocusBoundary
      announcement={describeRouteAnnouncement(pathname, hash)}
      focusKey={`${href}${hash}`}
      networkAction={retryCurrentRoute}
      networkState={networkState}
      targetId="main-content"
    >
      {children}
    </RouteFocusBoundary>
  );
}
