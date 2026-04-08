import { useMatchRoute } from "@tanstack/react-router";

const THREAD_ROUTE = "/$threadId";

function readId(match: unknown) {
  if (!match || typeof match !== "object") return null;
  const id = Reflect.get(match, "threadId");
  return typeof id === "string" ? id : null;
}

export function resolveRouteThreadId(cur: unknown, pend: unknown) {
  const next = readId(pend);
  if (next) return next;
  return readId(cur);
}

export function useRouteThreadId() {
  const match = useMatchRoute();
  return resolveRouteThreadId(
    match({ to: THREAD_ROUTE }),
    match({ to: THREAD_ROUTE, pending: true }),
  );
}
