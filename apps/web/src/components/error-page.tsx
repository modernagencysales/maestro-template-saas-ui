import { EmptyState } from "@saas-ui/react";

export function ErrorPage({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      height="100dvh"
    >
      {children}
    </EmptyState>
  );
}
