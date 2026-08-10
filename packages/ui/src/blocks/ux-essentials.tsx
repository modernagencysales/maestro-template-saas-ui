import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TemplateToastTone = "neutral" | "success" | "warning" | "danger";
export type TemplateAnnouncementPriority = "polite" | "assertive";

export type TemplateToast = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tone?: TemplateToastTone;
};

export type TemplateAnnouncementInput =
  | string
  | {
      readonly message: string;
      readonly priority?: TemplateAnnouncementPriority;
    };

export type TemplateToastInput = Omit<TemplateToast, "id"> & {
  readonly announcement?: TemplateAnnouncementInput;
  readonly autoDismissMs?: number;
  readonly id?: string;
};

export type TemplateToastApi = {
  readonly announce: (announcement: TemplateAnnouncementInput) => string;
  readonly announceAssertive: (message: string) => string;
  readonly notify: (toast: TemplateToastInput) => string;
  readonly dismiss: (toastId: string) => void;
};

const TemplateToastContext = createContext<TemplateToastApi | null>(null);

const missingTemplateToastApi: TemplateToastApi = {
  announce: () => "template-announcement-missing-provider",
  announceAssertive: () => "template-announcement-missing-provider",
  dismiss: () => {},
  notify: () => "template-toast-missing-provider",
};

type StoredAnnouncement = {
  readonly message: string;
};

const initialTemplateToasts = ({
  initialToasts,
  message,
}: {
  readonly initialToasts: readonly TemplateToast[];
  readonly message: string | undefined;
}): readonly TemplateToast[] => {
  if (!message) {
    return initialToasts;
  }

  return [
    ...initialToasts,
    {
      id: "template-toast-static-message",
      title: message,
      tone: "neutral",
    },
  ];
};

const clearToastTimer = (
  timers: Map<string, ReturnType<typeof setTimeout>>,
  toastId: string,
): void => {
  const timer = timers.get(toastId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  timers.delete(toastId);
};

const clearAllToastTimers = (
  timers: Map<string, ReturnType<typeof setTimeout>>,
): void => {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
};

const storeToast = (
  current: readonly TemplateToast[],
  toast: TemplateToast,
): readonly TemplateToast[] => [
  ...current.filter((existing) => existing.id !== toast.id),
  toast,
];

const normalizeAnnouncement = (
  announcement: TemplateAnnouncementInput,
): {
  readonly message: string;
  readonly priority: TemplateAnnouncementPriority;
} =>
  typeof announcement === "string"
    ? { message: announcement, priority: "polite" }
    : {
        message: announcement.message,
        priority: announcement.priority ?? "polite",
      };

const toastAnnouncement = (
  toast: TemplateToastInput,
): TemplateAnnouncementInput | undefined => toast.announcement;

const storedToastFromInput = (
  toast: TemplateToastInput,
): Omit<TemplateToast, "id"> => ({
  title: toast.title,
  ...(toast.description === undefined
    ? {}
    : { description: toast.description }),
  ...(toast.tone === undefined ? {} : { tone: toast.tone }),
});

const useTemplateAnnouncementState = () => {
  const nextAnnouncementId = useRef(0);
  const [politeAnnouncement, setPoliteAnnouncement] =
    useState<StoredAnnouncement | null>(null);
  const [assertiveAnnouncement, setAssertiveAnnouncement] =
    useState<StoredAnnouncement | null>(null);

  const announce = useCallback((announcement: TemplateAnnouncementInput) => {
    const { message, priority } = normalizeAnnouncement(announcement);
    const id = `template-announcement-${nextAnnouncementId.current++}`;
    const stored = { message };

    if (priority === "assertive") {
      setAssertiveAnnouncement(stored);
    } else {
      setPoliteAnnouncement(stored);
    }

    return id;
  }, []);

  const announceAssertive = useCallback(
    (message: string) => announce({ message, priority: "assertive" }),
    [announce],
  );

  return {
    announce,
    announceAssertive,
    assertiveAnnouncement,
    politeAnnouncement,
  };
};

const useTemplateStoredToasts = ({
  announce,
  defaultAutoDismissMs,
  initialToasts,
  message,
}: {
  readonly announce: (announcement: TemplateAnnouncementInput) => string;
  readonly defaultAutoDismissMs: number;
  readonly initialToasts: readonly TemplateToast[];
  readonly message: string | undefined;
}) => {
  const nextId = useRef(0);
  const dismissTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const [toasts, setToasts] = useState<readonly TemplateToast[]>(() =>
    initialTemplateToasts({ initialToasts, message }),
  );

  const dismiss = useCallback((toastId: string) => {
    clearToastTimer(dismissTimers.current, toastId);
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notify = useCallback(
    (toast: TemplateToastInput) => {
      const { autoDismissMs = defaultAutoDismissMs } = toast;
      const id = toast.id ?? `template-toast-${nextId.current++}`;

      clearToastTimer(dismissTimers.current, id);
      setToasts((current) =>
        storeToast(current, { ...storedToastFromInput(toast), id }),
      );

      const announcement = toastAnnouncement(toast);

      if (announcement) {
        announce(announcement);
      }

      if (autoDismissMs > 0) {
        dismissTimers.current.set(
          id,
          setTimeout(() => dismiss(id), autoDismissMs),
        );
      }

      return id;
    },
    [announce, defaultAutoDismissMs, dismiss],
  );

  useEffect(
    () => () => {
      clearAllToastTimers(dismissTimers.current);
    },
    [],
  );

  return { dismiss, notify, toasts };
};

const useTemplateToastState = ({
  defaultAutoDismissMs,
  initialToasts,
  message,
}: {
  readonly defaultAutoDismissMs: number;
  readonly initialToasts: readonly TemplateToast[];
  readonly message: string | undefined;
}) => {
  const {
    announce,
    announceAssertive,
    assertiveAnnouncement,
    politeAnnouncement,
  } = useTemplateAnnouncementState();
  const { dismiss, notify, toasts } = useTemplateStoredToasts({
    announce,
    defaultAutoDismissMs,
    initialToasts,
    message,
  });

  const api = useMemo<TemplateToastApi>(
    () => ({
      announce,
      announceAssertive,
      dismiss,
      notify,
    }),
    [announce, announceAssertive, dismiss, notify],
  );

  return { api, assertiveAnnouncement, dismiss, politeAnnouncement, toasts };
};

export function TemplateSkipLink({
  targetId = "template-main-content",
  children = "Skip to content",
}: {
  readonly targetId?: string;
  readonly children?: ReactNode;
}) {
  return (
    <a className="template-skip-link" href={`#${targetId}`}>
      {children}
    </a>
  );
}

export function TemplateLiveRegion({ message }: { readonly message: string }) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="template-live-region"
      role="status"
    >
      {message}
    </div>
  );
}

export function TemplateNetworkBanner({
  action,
  state,
}: {
  readonly action?: ReactNode;
  readonly state: "online" | "offline" | "degraded";
}) {
  if (state === "online") {
    return null;
  }

  return (
    <div className={`template-network-banner ${state}`} role="status">
      <span>
        {state === "offline"
          ? "You are offline. Local draft state remains available."
          : "Network is degraded. Live provider calls may be delayed."}
      </span>
      {action ? (
        <span className="template-network-banner-action">{action}</span>
      ) : null}
    </div>
  );
}

export function TemplateRouteFocusBoundary({
  announcement,
  children,
  focusKey,
  networkAction,
  networkState = "online",
  targetId = "template-main-content",
}: {
  readonly announcement: string;
  readonly children: ReactNode;
  readonly focusKey: string;
  readonly networkAction?: ReactNode;
  readonly networkState?: "online" | "offline" | "degraded";
  readonly targetId?: string;
}) {
  useEffect(() => {
    const focusTarget = () => {
      const target = document.getElementById(targetId);

      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    };

    focusTarget();
    const settledFocus = window.setTimeout(focusTarget, 175);

    return () => window.clearTimeout(settledFocus);
  }, [focusKey, targetId]);

  return (
    <>
      <TemplateSkipLink targetId={targetId} />
      <TemplateLiveRegion message={announcement} />
      <TemplateNetworkBanner action={networkAction} state={networkState} />
      {children}
    </>
  );
}

export function TemplateMainContent({
  children,
  className,
  id = "template-main-content",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}) {
  return (
    <main className={className} id={id} tabIndex={-1}>
      {children}
    </main>
  );
}

export function TemplateEmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <section className="template-empty-state" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export function TemplateToastProvider({
  children,
  defaultAutoDismissMs = 5000,
  initialToasts = [],
  message,
}: {
  readonly children: ReactNode;
  readonly defaultAutoDismissMs?: number;
  readonly initialToasts?: readonly TemplateToast[];
  readonly message?: string;
}) {
  const { api, assertiveAnnouncement, dismiss, politeAnnouncement, toasts } =
    useTemplateToastState({
      defaultAutoDismissMs,
      initialToasts,
      message,
    });

  return (
    <TemplateToastContext.Provider value={api}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="template-live-region template-announcement-region"
        role="status"
      >
        {politeAnnouncement?.message}
      </div>
      <div
        aria-atomic="true"
        aria-live="assertive"
        className="template-live-region template-announcement-region"
        role="alert"
      >
        {assertiveAnnouncement?.message}
      </div>
      <div aria-live="polite" className="template-toast-region">
        {toasts.map((toast) => (
          <div
            className={`template-toast ${toast.tone ?? "neutral"}`}
            key={toast.id}
            role={toast.tone === "danger" ? "alert" : "status"}
          >
            <div>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button
              aria-label={`Dismiss ${toast.title}`}
              onClick={() => dismiss(toast.id)}
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </TemplateToastContext.Provider>
  );
}

export function useTemplateToast(): TemplateToastApi {
  return useContext(TemplateToastContext) ?? missingTemplateToastApi;
}

export function TemplateRoutePending({
  description = "Preparing the workspace route.",
  label = "Loading page",
}: {
  readonly description?: string;
  readonly label?: string;
}) {
  return (
    <TemplateMainContent className="template-route-state">
      <div className="template-route-state-panel" role="status">
        <p className="template-route-state-kicker">Please wait</p>
        <h1>{label}</h1>
        <p>{description}</p>
      </div>
    </TemplateMainContent>
  );
}

export function TemplateRouteError({
  action,
  description = "The page could not be loaded. Try again or return to a safe workspace page.",
  title = "Something went wrong",
}: {
  readonly action?: ReactNode;
  readonly description?: string;
  readonly title?: string;
}) {
  return (
    <TemplateMainContent className="template-route-state error">
      <div className="template-route-state-panel" role="alert">
        <p className="template-route-state-kicker">Route unavailable</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {action ? (
          <div className="template-route-state-actions">{action}</div>
        ) : null}
      </div>
    </TemplateMainContent>
  );
}

export function useTemplateFocusReturn() {
  const lastFocused = useRef<HTMLElement | null>(null);

  const captureFocus = useCallback(() => {
    lastFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  const returnFocus = useCallback(() => {
    lastFocused.current?.focus();
  }, []);

  return { captureFocus, returnFocus };
}
