import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/contacts")({
  component: ContactsRoute,
});

function ContactsRoute() {
  return <Outlet />;
}
