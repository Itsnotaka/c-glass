import type { PiSessionItem } from "@glass/contracts";
import { memo, useEffect, useRef, useState } from "react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { GlassPiLive, GlassPiTranscript } from "./glass-pi-chat-rows";

export const GlassPiMessages = memo(function GlassPiMessages(props: {
  messages: PiSessionItem[];
  live: PiSessionItem | null;
  expanded: boolean;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const stick = useRef(true);
  const [wide, setWide] = useState(640);

  useEffect(() => {
    const node = list.current;
    if (!node) return;

    const sync = () => {
      const css = window.getComputedStyle(node);
      const left = Number.parseFloat(css.paddingLeft || "0");
      const right = Number.parseFloat(css.paddingRight || "0");
      const next = Math.max(160, Math.floor(node.clientWidth - left - right - 48));
      setWide((cur) => (cur === next ? cur : next));
    };

    sync();

    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(sync);
    obs.observe(node);

    return () => {
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = viewport.current;
    if (!node || !stick.current) return;

    const id = window.requestAnimationFrame(() => {
      const next = viewport.current;
      if (!next || !stick.current) return;
      next.scrollTop = next.scrollHeight;
    });

    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [props.messages, props.live, props.expanded]);

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      scrollFade
      scrollbarGutter
      viewportRef={viewport}
      onViewportScroll={(event) => {
        const node = event.currentTarget;
        stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      }}
    >
      <ul ref={list} className="mx-auto flex max-w-[43.875rem] flex-col gap-2 px-4 py-4 md:px-8">
        <GlassPiTranscript items={props.messages} expanded={props.expanded} wide={wide} />
        <GlassPiLive item={props.live} expanded={props.expanded} wide={wide} />
      </ul>
    </ScrollArea>
  );
});
