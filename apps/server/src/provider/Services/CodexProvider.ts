import * as Context from "effect/ServiceMap";

import type { ServerProviderShape } from "./ServerProvider";

export interface CodexProviderShape extends ServerProviderShape {}

export class CodexProvider extends Context.Service<CodexProvider, CodexProviderShape>()(
  "glass/provider/Services/CodexProvider",
) {}
