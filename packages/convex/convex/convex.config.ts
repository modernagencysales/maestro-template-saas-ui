import migrations from "@convex-dev/migrations/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import posthog from "@posthog/convex/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";
import workflowDeadline from "./components/workflowDeadline/convex.config";
import workflowAdmission from "./components/workflowAdmission/convex.config";

const app = defineApp({
  env: {
    POSTHOG_PROJECT_TOKEN: v.string(),
    POSTHOG_HOST: v.optional(v.string()),
  },
});

app.use(posthog, {
  env: {
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
    POSTHOG_HOST: app.env.POSTHOG_HOST,
  },
});
app.use(workpool, { name: "workpool" });
app.use(workpool, { name: "workflowDeadlineWorkpool" });
app.use(workflow, { name: "workflow" });
app.use(workflowDeadline, { name: "workflowDeadline" });
app.use(workflowAdmission, { name: "workflowAdmission" });
app.use(migrations, { name: "migrations" });
app.use(prosemirrorSync);

export default app;
