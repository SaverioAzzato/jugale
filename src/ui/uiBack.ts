import { useEffect, useRef, useSyncExternalStore } from "react";

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

/** Register a transient UI layer. The most recently mounted layer gets first refusal. */
function register(handler: BackHandler): () => void {
  handlers.push(handler);
  notify();
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
    notify();
  };
}

/** Close the topmost transient layer that currently owns Back. */
export function handleTransientBack(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]()) return true;
  }
  return false;
}

/** Components use this for lightboxes, popovers and secondary panels. */
export function useUiBackHandler(active: boolean, handler: BackHandler): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active) return;
    return register(() => handlerRef.current());
  }, [active]);
}

function subscribe(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

const snapshot = (): number => handlers.length;

/** App uses the depth to install Android's native Back listener only when UI can go back. */
export function useUiBackDepth(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
