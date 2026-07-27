import { createFileRoute } from "@tanstack/react-router";
import { RecordsScreen } from "../screens/records-screen.js";

export const Route = createFileRoute("/_workspace/records")({
  component: RecordsScreen,
});
