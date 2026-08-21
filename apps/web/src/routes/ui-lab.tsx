import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ui-lab")({
  component: Outlet,
});
