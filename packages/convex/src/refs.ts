import { GroupSpec, Refs, Spec } from "@confect/core";

import members from "../confect/access/members.spec";
import provisioning from "../confect/access/provisioning.spec";
import workspaces from "../confect/auth/workspaces.spec";

const frontendSpec = Spec.make()
  .addAt(
    "access",
    GroupSpec.makeAt("access")
      .addGroupAt("members", members)
      .addGroupAt("provisioning", provisioning),
  )
  .addAt("auth", GroupSpec.makeAt("auth").addGroupAt("workspaces", workspaces));

export const templateConfectRefs = Refs.make(frontendSpec);

export type TemplateConfectRefs = typeof templateConfectRefs;
