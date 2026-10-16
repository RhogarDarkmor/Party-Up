import "server-only";

import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_CLIENTS = 2_000;

type AttemptWindow = {
  count: number;
  expiresAt: number;
};

const attemptsByClient = new Map<string, AttemptWindow>();

function getClientKey(address: string) {
  return createHash("sha256").update(address).digest("hex");
}

function removeExpiredWindows(now: number) {
  for (const [key, window] of attemptsByClient) {
    if (window.expiresAt <= now) {
      attemptsByClient.delete(key);
    }
  }
}

export function checkAdminLoginLimit(address: string) {
  const now = Date.now();
  const key = getClientKey(address);
  let window = attemptsByClient.get(key);

  if (window && window.expiresAt <= now) {
    attemptsByClient.delete(key);
    window = undefined;
  }

  if (!window && attemptsByClient.size >= MAX_TRACKED_CLIENTS) {
    removeExpiredWindows(now);
    if (attemptsByClient.size >= MAX_TRACKED_CLIENTS) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
  }

  if (!window) {
    window = { count: 0, expiresAt: now + WINDOW_MS };
    attemptsByClient.set(key, window);
  }

  if (window.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((window.expiresAt - now) / 1000),
      ),
    };
  }

  window.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearAdminLoginLimit(address: string) {
  attemptsByClient.delete(getClientKey(address));
}
