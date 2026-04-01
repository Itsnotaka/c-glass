import { Effect, Layer } from "effect";

import { TextGenerationError } from "../Errors.ts";
import { TextGeneration, type TextGenerationShape } from "../Services/TextGeneration.ts";

const disabled = (operation: string) =>
  Effect.fail(
    new TextGenerationError({
      operation,
      detail: "Git AI text generation is not available (no provider adapters in this build).",
    }),
  );

const noop: TextGenerationShape = {
  generateCommitMessage: () => disabled("TextGeneration.generateCommitMessage"),
  generatePrContent: () => disabled("TextGeneration.generatePrContent"),
  generateBranchName: () => disabled("TextGeneration.generateBranchName"),
  generateThreadTitle: () => disabled("TextGeneration.generateThreadTitle"),
};

export const NoopTextGenerationLive = Layer.succeed(TextGeneration, noop);
