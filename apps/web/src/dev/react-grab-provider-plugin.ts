import { PROVIDER_NOTICE_KIND } from "@glass/contracts";

import { useProviderNoticeDevStore } from "./provider-notice-dev-store";

const name = "glass-provider-notice";

export async function installReactGrabProviderPlugin() {
  const grab = await import("react-grab");
  grab.unregisterPlugin(name);
  grab.registerPlugin({
    name,
    actions: [
      {
        id: "glass-provider-rate",
        label: "Force rate-limit banner",
        shortcut: "R",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().show(PROVIDER_NOTICE_KIND.rateLimit);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-auth",
        label: "Force auth banner",
        shortcut: "A",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().show(PROVIDER_NOTICE_KIND.auth);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-config",
        label: "Force config banner",
        shortcut: "G",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().show(PROVIDER_NOTICE_KIND.config);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-clear",
        label: "Clear forced banner",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().clear();
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-logs-on",
        label: "Show logs",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setLogs(true);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-logs-off",
        label: "Hide logs",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setLogs(false);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-all-on",
        label: "Show all logs",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setAll(true);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-all-off",
        label: "Hide all logs",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setAll(false);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-raw-on",
        label: "Show raw payload",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setRaw(true);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-provider-raw-off",
        label: "Hide raw payload",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          useProviderNoticeDevStore.getState().setRaw(false);
          ctx.hideContextMenu();
        },
      },
    ],
  });
}
