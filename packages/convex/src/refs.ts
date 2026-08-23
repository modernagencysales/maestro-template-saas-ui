import { GroupSpec, Ref, Refs, Spec } from "@confect/core";

import members from "../confect/access/members.spec";
import provisioning from "../confect/access/provisioning.spec";
import assistant from "../confect/agents/assistant.spec";
import workspaces from "../confect/auth/workspaces.spec";
import brainPages from "../confect/brain/pages.spec";
import connections from "../confect/integrations/connections.spec";

const frontendSpec = Spec.make()
  .addAt(
    "access",
    GroupSpec.makeAt("access")
      .addGroupAt("members", members)
      .addGroupAt("provisioning", provisioning),
  )
  .addAt(
    "agents",
    GroupSpec.makeAt("agents").addGroupAt("assistant", assistant),
  )
  .addAt("auth", GroupSpec.makeAt("auth").addGroupAt("workspaces", workspaces))
  .addAt("brain", GroupSpec.makeAt("brain").addGroupAt("pages", brainPages))
  .addAt(
    "integrations",
    GroupSpec.makeAt("integrations").addGroupAt("connections", connections),
  );

export const templateConfectRefs = Refs.make(frontendSpec);
export const getFunctionReference = Ref.getFunctionReference;
export { GroupSpec, Refs, Spec };

export type TemplateConfectRefs = typeof templateConfectRefs;
