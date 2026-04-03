"use client";

import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

function SettingsLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <Outlet />
    </div>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings" || location.pathname === "/settings/general") {
      throw redirect({ to: "/settings/appearance", replace: true });
    }
  },
  component: SettingsLayout,
});
