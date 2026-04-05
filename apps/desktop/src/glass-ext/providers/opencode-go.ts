import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

const AUTH_URL = "https://opencode.ai/auth";
const NEVER_EXPIRES = 253402300799000;

async function loginOpenCodeGo(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  callbacks.onAuth({
    url: AUTH_URL,
    instructions: "Log in and copy your API key",
  });

  const apiKey = await callbacks.onPrompt({
    message: "Paste your OpenCode API key",
    placeholder: "sk-...",
  });

  const access = apiKey.trim();
  if (!access) throw new Error("API key is required");

  return {
    access,
    refresh: access,
    expires: NEVER_EXPIRES,
  };
}

async function refreshOpenCodeGoToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  return {
    ...credentials,
    expires: NEVER_EXPIRES,
  };
}

export function registerOpenCodeGoProvider(pi: ExtensionAPI) {
  pi.registerProvider("opencode-go", {
    oauth: {
      name: "OpenCode Go",
      login: loginOpenCodeGo,
      refreshToken: refreshOpenCodeGoToken,
      getApiKey: (credentials) => credentials.access,
    },
  });
}
