import type { ReactNode } from "react";

export const DateTime = ({
  children,
  date,
  style,
}: {
  children?: ReactNode;
  date?: Date;
  style?: "short" | "long" | "narrow";
}) => {
  void style;
  return children ?? (date ? date.toLocaleDateString() : null);
};
export const RelativeTime = DateTime;
export const DateTimeSince = DateTime;
export const useIntl = () => ({
  formatDate: (date: Date) => date.toLocaleDateString(),
  formatTime: (date: Date) => date.toLocaleTimeString(),
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
    value.toLocaleString(undefined, options),
});
export const FormattedDate = ({ value }: { value: Date | string | number }) =>
  new Date(value).toLocaleDateString();
export const FormattedNumber = ({
  value,
  currency,
  style = "decimal",
}: {
  value: number;
  currency?: string;
  style?: "decimal" | "currency";
}) =>
  value.toLocaleString(undefined, {
    style: style === "currency" && currency ? style : "decimal",
    ...(currency ? { currency } : {}),
  });
