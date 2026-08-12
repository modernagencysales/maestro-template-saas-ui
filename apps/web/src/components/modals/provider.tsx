import * as React from "react";

export type ModalComponent = React.ComponentType<any>;
export type ModalOptions = {
  component: ModalComponent;
  [key: string]: unknown;
};
export type ConfirmOptions = {
  title?: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  confirmProps?: Record<string, unknown>;
  onConfirm?: () => void | Promise<void>;
};
type ModalsApi = {
  open: (component: ModalComponent | ModalOptions) => string | null;
  close: () => void;
  closeAll: () => void;
  confirm: (options: ConfirmOptions) => string | null;
};

const ModalsContext = React.createContext<ModalsApi>({
  open: () => null,
  close: () => undefined,
  closeAll: () => undefined,
  confirm: () => null,
});

export function ModalsProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<ModalComponent | null>(null);
  const api = React.useMemo<ModalsApi>(() => {
    const close = () => setModal(null);
    return {
      open(input) {
        setModal(typeof input === "function" ? input : input.component);
        return "modal";
      },
      close,
      closeAll: close,
      confirm(options) {
        setModal(() => () => null);
        void options.onConfirm;
        return "confirm";
      },
    };
  }, []);
  return (
    <ModalsContext.Provider value={api}>
      {children}
      {modal ? React.createElement(modal, { open: true, onClose: api.close }) : null}
    </ModalsContext.Provider>
  );
}

export const useModals = () => React.useContext(ModalsContext);
