export const DEMO_ACCESS_STORAGE_KEY = "deltazero_demo_access_key";
export const DEMO_ACCESS_CHANGE_EVENT = "deltazero:demo-access-change";

export function getDemoAccessKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(DEMO_ACCESS_STORAGE_KEY);
}

export function hasDemoAccess(): boolean {
  return Boolean(getDemoAccessKey());
}

export function subscribeToDemoAccess(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DEMO_ACCESS_CHANGE_EVENT, callback);
  return () => window.removeEventListener(DEMO_ACCESS_CHANGE_EVENT, callback);
}

export function enableDemoAccess(key: string): boolean {
  if (typeof window === "undefined") return false;
  const normalized = key.trim();
  if (!normalized) return false;
  window.sessionStorage.setItem(DEMO_ACCESS_STORAGE_KEY, normalized);
  window.dispatchEvent(new Event(DEMO_ACCESS_CHANGE_EVENT));
  return true;
}

export function clearDemoAccess(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
  window.dispatchEvent(new Event(DEMO_ACCESS_CHANGE_EVENT));
}
