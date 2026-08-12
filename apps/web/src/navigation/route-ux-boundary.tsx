import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box } from "@saas-ui/react";
import { describeRouteAnnouncement } from "./route-announcements";
import { useBrowserNetworkState } from "./network-state";

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

  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
  }, [href, hash]);
  return (
    <Box
      ref={focusRef}
      tabIndex={-1}
      aria-live="polite"
      data-network-state={networkState}
      data-route-announcement={describeRouteAnnouncement(pathname, hash)}
    >
      {children}
      {networkState !== "online" ? (
        <button onClick={retryCurrentRoute} type="button">
          Retry now
        </button>
      ) : null}
    </Box>
  );
}
