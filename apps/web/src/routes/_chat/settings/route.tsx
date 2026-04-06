"use client";

import { createFileRoute, redirect } from "@tanstack/react-router";

import { GlassSettingsShell } from "../../../components/glass/settings-shell";

export const Route = createFileRoute("/_chat/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings" || location.pathname === "/settings/general") {
      throw redirect({ to: "/settings/appearance", replace: true });
    }
  },
  component: GlassSettingsShell,
});
