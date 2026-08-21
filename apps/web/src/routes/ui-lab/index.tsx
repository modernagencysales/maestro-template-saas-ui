import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ui-lab/")({
  beforeLoad: () => {
    throw redirect({
      to: "/ui-lab/$demo",
      params: { demo: "writer" },
    });
  },
});
