import {
  Button,
  type ButtonProps,
  type ClipboardCopyStatusDetails,
} from "@chakra-ui/react";
import { useClipboard } from "@saas-ui/react";
import { TbCheck, TbCopy } from "react-icons/tb";

export const CopyButton = ({
  value,
  onStatusChange,
  children,
  ...props
}: ButtonProps & {
  value: string;
  onStatusChange?: (details: ClipboardCopyStatusDetails) => void;
  children: React.ReactNode;
}) => {
  const { copy, copied } = useClipboard({
    onStatusChange,
    value,
  });

  return (
    <Button onClick={copy} {...props}>
      {children} {copied ? <TbCheck /> : <TbCopy />}
    </Button>
  );
};
