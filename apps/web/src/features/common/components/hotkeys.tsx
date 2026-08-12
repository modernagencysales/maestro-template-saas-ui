import { HotkeysConfig, HotkeysProvider } from "@saas-ui/use-hotkeys";

import { appHotkeys } from "#config/hotkeys.config";

interface HotkeysProps {
  hotkeys?: HotkeysConfig;
  children: React.ReactNode;
}

export const Hotkeys: React.FC<HotkeysProps> = ({ children, hotkeys }) => {
  return (
    <HotkeysProvider hotkeys={hotkeys || appHotkeys}>
      {children}
    </HotkeysProvider>
  );
};
