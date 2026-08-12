import type { ReactNode } from "react";

export const DateTime = ({
  children,
  date,
}: {
  children?: ReactNode;
  date?: Date;
}) => children ?? (date ? date.toLocaleDateString() : null);
export const RelativeTime = DateTime;
export const DateTimeSince = DateTime;
export const useIntl = () => ({
  formatDate: (date: Date) => date.toLocaleDateString(),
  formatTime: (date: Date) => date.toLocaleTimeString(),
});
export const FormattedDate = ({ value }: { value: Date | string | number }) =>
  new Date(value).toLocaleDateString();
export const FormattedNumber = ({ value }: { value: number }) =>
  value.toLocaleString();
