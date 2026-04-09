"use client";

import { createFileRoute } from "@tanstack/react-router";

import { GlassHeroCanvas } from "~/components/glass/chat/hero-canvas";

function ChatIndexRouteView() {
  return <GlassHeroCanvas />;
}

export const Route = createFileRoute("/_chat/_shell/")({
  component: ChatIndexRouteView,
});
