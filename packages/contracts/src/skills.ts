import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";

export const GlassSkill = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  body: Schema.String,
});
export type GlassSkill = typeof GlassSkill.Type;

export class SkillListError extends Schema.TaggedErrorClass<SkillListError>()("SkillListError", {
  message: TrimmedNonEmptyString,
  cause: Schema.optional(Schema.Defect),
}) {}
