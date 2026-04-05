import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

const AUTH_URL = "https://app.fireworks.ai/api-keys";
const NEVER_EXPIRES = 253402300799000;

async function loginFireworks(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  callbacks.onAuth({
    url: AUTH_URL,
    instructions: "Create or copy your Fireworks API key, then paste it below.",
  });

  const apiKey = await callbacks.onPrompt({
    message: "Paste your Fireworks API key",
    placeholder: "fw_...",
  });

  const access = apiKey.trim();
  if (!access) throw new Error("API key is required");

  return {
    access,
    refresh: access,
    expires: NEVER_EXPIRES,
  };
}

async function refreshFireworksToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  return {
    ...credentials,
    expires: NEVER_EXPIRES,
  };
}

export function registerFireworksProvider(pi: ExtensionAPI) {
  pi.registerProvider("fireworks", {
    oauth: {
      name: "Fireworks",
      login: loginFireworks,
      refreshToken: refreshFireworksToken,
      getApiKey: (credentials) => credentials.access,
    },
  });
}
