import { useEffect, useState } from "react";

function match(query: string) {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => match(query));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => {
      setMatches(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}
