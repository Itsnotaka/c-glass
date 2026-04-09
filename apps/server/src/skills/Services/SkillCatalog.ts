import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { GlassSkill } from "@glass/contracts";

export class SkillCatalogError extends Schema.TaggedErrorClass<SkillCatalogError>()(
  "SkillCatalogError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface SkillCatalogShape {
  readonly list: () => Effect.Effect<GlassSkill[], SkillCatalogError>;
}

export class SkillCatalog extends ServiceMap.Service<SkillCatalog, SkillCatalogShape>()(
  "glass/skills/Services/SkillCatalog",
) {}
