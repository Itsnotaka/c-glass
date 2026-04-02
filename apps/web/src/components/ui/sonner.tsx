import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type CSSProperties, useSyncExternalStore } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

type Theme = NonNullable<ToasterProps["theme"]>;

export function Toaster(props: ToasterProps) {
  const theme = useSyncExternalStore(
    (on) => {
      const el = document.documentElement;
      const obs = new MutationObserver(on);
      obs.observe(el, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    (): Theme => "light",
  );

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4" />,
        loading: <LoaderCircleIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}
