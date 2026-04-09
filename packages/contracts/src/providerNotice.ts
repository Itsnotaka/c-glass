export const PROVIDER_NOTICE_KIND = {
  rateLimit: "provider.notice.rate-limit",
  auth: "provider.notice.auth",
  config: "provider.notice.config",
} as const;

export type ProviderNoticeKind = (typeof PROVIDER_NOTICE_KIND)[keyof typeof PROVIDER_NOTICE_KIND];

export const PROVIDER_NOTICE_KINDS = Object.values(PROVIDER_NOTICE_KIND);
