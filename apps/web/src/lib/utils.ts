import { type CxOptions, cx } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: CxOptions) => twMerge(cx(inputs));

function firstNonEmptyString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  throw new Error("No non-empty string provided");
}

export const resolveServerUrl = (options?: {
  url?: string | undefined;
  protocol?: "http" | "https" | "ws" | "wss" | undefined;
  pathname?: string | undefined;
  searchParams?: Record<string, string> | undefined;
}): string => {
  const raw = firstNonEmptyString(
    options?.url,
    window.desktopBridge?.getWsUrl(),
    import.meta.env.VITE_WS_URL,
    window.location.origin,
  );

  const next = new URL(raw);
  if (options?.protocol) {
    next.protocol = options.protocol;
  }
  next.pathname = options?.pathname ?? "/";
  if (options?.searchParams) {
    next.search = new URLSearchParams(options.searchParams).toString();
  }
  return next.toString();
};
