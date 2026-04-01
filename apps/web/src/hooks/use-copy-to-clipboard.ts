import { useEffect, useState } from "react";

export function useCopyToClipboard(timeout = 1500) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied || typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      setIsCopied(false);
    }, timeout);
    return () => {
      window.clearTimeout(id);
    };
  }, [isCopied, timeout]);

  const copyToClipboard = async (text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    return true;
  };

  return { copyToClipboard, isCopied };
}
