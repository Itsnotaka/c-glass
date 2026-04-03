import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

export interface PiModelRef {
  provider: string;
  id: string;
  name?: string | null;
  reasoning?: boolean;
}

export const PiThinkingLevel = Schema.Literals([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);
export type PiThinkingLevel = typeof PiThinkingLevel.Type;

export const PiModelCost = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
});
export type PiModelCost = typeof PiModelCost.Type;

export const PiModel = Schema.Struct({
  provider: TrimmedNonEmptyString,
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  api: Schema.String,
  baseUrl: Schema.String,
  reasoning: Schema.Boolean,
  input: Schema.Array(Schema.Literals(["text", "image"])),
  cost: PiModelCost,
  contextWindow: Schema.Number,
  maxTokens: Schema.Number,
  compat: Schema.optional(Schema.Unknown),
});
export type PiModel = typeof PiModel.Type;

export const PiProviderAuthType = Schema.NullOr(Schema.Literals(["api_key", "oauth"]));
export type PiProviderAuthType = typeof PiProviderAuthType.Type;

export const PiProviderState = Schema.Struct({
  provider: TrimmedNonEmptyString,
  configured: Schema.Boolean,
  credentialType: PiProviderAuthType,
  oauthSupported: Schema.Boolean,
});
export type PiProviderState = typeof PiProviderState.Type;

export const PiDefaults = Schema.Struct({
  provider: Schema.NullOr(TrimmedNonEmptyString),
  model: Schema.NullOr(TrimmedNonEmptyString),
  thinkingLevel: Schema.NullOr(PiThinkingLevel),
});
export type PiDefaults = typeof PiDefaults.Type;

export const PiConfig = Schema.Struct({
  agentDir: Schema.String,
  settingsPath: Schema.String,
  projectSettingsPath: Schema.String,
  modelsPath: Schema.String,
  authPath: Schema.String,
  defaults: PiDefaults,
  providers: Schema.Array(PiProviderState),
  models: Schema.Array(PiModel),
  available: Schema.Array(TrimmedNonEmptyString),
  error: Schema.NullOr(Schema.String),
});
export type PiConfig = typeof PiConfig.Type;

export const PiDefaultModelInput = Schema.Struct({
  provider: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
});
export type PiDefaultModelInput = typeof PiDefaultModelInput.Type;

export const PiProviderInput = Schema.Struct({
  provider: TrimmedNonEmptyString,
});
export type PiProviderInput = typeof PiProviderInput.Type;

export const PiApiKeyInput = Schema.Struct({
  provider: TrimmedNonEmptyString,
  key: TrimmedNonEmptyString,
});
export type PiApiKeyInput = typeof PiApiKeyInput.Type;

export const PiThinkingLevelInput = Schema.Struct({
  thinkingLevel: PiThinkingLevel,
});
export type PiThinkingLevelInput = typeof PiThinkingLevelInput.Type;

export interface PiBridge {
  getConfig: () => Promise<PiConfig>;
  /** Desktop preload: initial Pi config snapshot fetched before first paint. */
  readBootConfig?: () => PiConfig | null;
  setDefaultModel: (provider: string, model: string) => Promise<void>;
  clearDefaultModel: () => Promise<void>;
  setDefaultThinkingLevel: (thinkingLevel: PiThinkingLevel) => Promise<void>;
  getApiKey: (provider: string) => Promise<string | null>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  /** Desktop: run Pi OAuth login for a provider (opens browser / prompts as needed). */
  startOAuthLogin: (provider: string) => Promise<void>;
}
