import { GroupSpec, Ref, Refs, Spec } from "@confect/core";

import members from "../confect/access/members.spec";
import provisioning from "../confect/access/provisioning.spec";
import workspaces from "../confect/auth/workspaces.spec";
import brainPages from "../confect/brain/pages.spec";

const frontendSpec = Spec.make()
  .addAt(
    "access",
    GroupSpec.makeAt("access")
      .addGroupAt("members", members)
      .addGroupAt("provisioning", provisioning),
  )
  .addAt("auth", GroupSpec.makeAt("auth").addGroupAt("workspaces", workspaces))
  .addAt("brain", GroupSpec.makeAt("brain").addGroupAt("pages", brainPages));

export const templateConfectRefs = Refs.make(frontendSpec);
export const getFunctionReference = Ref.getFunctionReference;
export { GroupSpec, Refs, Spec };

export type TemplateConfectRefs = typeof templateConfectRefs;
