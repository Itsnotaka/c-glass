import type { GlassWorkingSnapshot, GlassWorkingUpdate } from "@glass/contracts";
import * as Context from "effect/ServiceMap";
import type { Effect, Stream } from "effect";

export interface WorkingStateShape {
  readonly getSnapshot: Effect.Effect<GlassWorkingSnapshot>;
  readonly streamChanges: Stream.Stream<GlassWorkingUpdate>;
}

export class WorkingState extends Context.Service<WorkingState, WorkingStateShape>()(
  "glass/orchestration/Services/WorkingState",
) {}
