import { Ref, Refs } from "@confect/core";

import spec from "../confect/_generated/spec";

export const templateConfectRefs = Refs.make(spec);
export const getFunctionReference = Ref.getFunctionReference;

export type TemplateConfectRefs = typeof templateConfectRefs;
