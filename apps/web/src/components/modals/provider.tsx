import * as React from "react";

type ModalComponent = React.ComponentType<{
  open?: boolean;
  onClose?: () => void;
}>;
type ModalsApi = {
  open: (component: ModalComponent) => void;
  close: () => void;
};

const ModalsContext = React.createContext<ModalsApi>({
  open: () => undefined,
  close: () => undefined,
});

export function ModalsProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<ModalComponent | null>(null);
  const api = React.useMemo<ModalsApi>(
    () => ({ open: setModal, close: () => setModal(null) }),
    [],
  );
  return (
    <ModalsContext.Provider value={api}>
      {children}
      {modal
        ? React.createElement(modal, { open: true, onClose: api.close })
        : null}
    </ModalsContext.Provider>
  );
}

export const useModals = () => React.useContext(ModalsContext);
