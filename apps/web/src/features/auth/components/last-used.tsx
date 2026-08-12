import { useEffect, useState } from "react";

import { useLocalStorageValue } from "@react-hookz/web";
import { Tooltip } from "@saas-ui/react";

export function LastUsedProvider(props: {
  children: React.ReactNode;
  value: string;
}) {
  const lastUsed = useLocalStorageValue("lastUsedProvider");

  const [match, setMatch] = useState(false);

  useEffect(() => {
    // not pretty, but we trigger this after first render, to prevent SSR mismatch
    // and trigger animation on load
    setMatch(lastUsed.value === props.value);
  }, [match, lastUsed.value, props.value]);

  return (
    <Tooltip
      content="Last used"
      disabled={!match}
      positioning={{
        placement: "right",
        offset: {
          mainAxis: 20,
        },
      }}
      interactive={false}
      skipAnimationOnMount
      open={match}
      showArrow
      contentProps={{
        css: {
          "--tooltip-bg": "colors.bg.emphasized",
        },
        border: "0",
        boxShadow: "none",
      }}
    >
      {props.children}
    </Tooltip>
  );
}
