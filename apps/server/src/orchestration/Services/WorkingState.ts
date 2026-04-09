import type { GlassWorkingSnapshot, GlassWorkingUpdate } from "@glass/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export interface WorkingStateShape {
  readonly getSnapshot: Effect.Effect<GlassWorkingSnapshot>;
  readonly streamChanges: Stream.Stream<GlassWorkingUpdate>;
}

export class WorkingState extends ServiceMap.Service<WorkingState, WorkingStateShape>()(
  "glass/orchestration/Services/WorkingState",
) {}
