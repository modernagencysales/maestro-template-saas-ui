import { useCallback, useEffect, useRef, useState } from "react";

export const useOpenState = (
  props: {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (details: { open: boolean }) => void;
  } = {},
) => {
  const [value, setValue] = useState(props.defaultOpen);

  const isControlled = props.open !== undefined;

  const handleChange = useRef(props.onOpenChange);

  useEffect(() => {
    handleChange.current = props.onOpenChange;
  }, [props.onOpenChange]);

  const setOpen: React.Dispatch<React.SetStateAction<boolean | undefined>> =
    useCallback(
      (nextValue) => {
        if (isControlled) {
          const value =
            typeof nextValue === "function" ? nextValue(props.open) : nextValue;
          if (value !== props.open) {
            handleChange.current?.({ open: !!value });
          }
        } else {
          setValue(nextValue);
        }
      },
      [isControlled, props.open, handleChange],
    );

  return {
    open: isControlled ? props.open : value,
    setOpen,
    onOpenChange: ({ open }: { open: boolean }) => setOpen(open),
  };
};
