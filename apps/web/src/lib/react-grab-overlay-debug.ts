/** Selectors for Base UI overlay surfaces we tag with `data-slot` (tooltips, menus, popovers). */
export const GLASS_OVERLAY_HOST_SELECTOR = [
  "[data-slot=tooltip-content]",
  "[data-slot=tooltip-trigger]",
  "[data-slot=context-menu-root]",
  "[data-slot=context-menu-popup]",
  "[data-slot=context-menu-trigger]",
  "[data-slot=popover-token-menu]",
].join(",");

export const GLASS_OVERLAY_DEBUG_CLASS = "glass-overlay-debug";

const PLUGIN = "glass-overlay-debug";

export async function registerGlassOverlayDebug(): Promise<() => void> {
  const { registerPlugin, unregisterPlugin } = await import("react-grab");

  registerPlugin({
    name: PLUGIN,
    actions: [
      {
        id: "glass-toggle-overlay-outlines",
        label: "Toggle overlay outlines",
        shortcut: "O",
        showInToolbarMenu: true,
        onAction: (ctx) => {
          document.documentElement.classList.toggle(GLASS_OVERLAY_DEBUG_CLASS);
          ctx.hideContextMenu();
        },
      },
      {
        id: "glass-log-overlay-hosts",
        label: "Log overlay hosts",
        onAction: (ctx) => {
          const nodes = document.querySelectorAll(GLASS_OVERLAY_HOST_SELECTOR);
          console.group("[Glass] overlay hosts");
          nodes.forEach((el) => {
            console.log(el.getAttribute("data-slot"), el);
          });
          console.groupEnd();
          ctx.hideContextMenu();
        },
      },
    ],
    hooks: {
      onDeactivate: () => {
        document.documentElement.classList.remove(GLASS_OVERLAY_DEBUG_CLASS);
      },
    },
  });

  return () => {
    unregisterPlugin(PLUGIN);
    document.documentElement.classList.remove(GLASS_OVERLAY_DEBUG_CLASS);
  };
}
