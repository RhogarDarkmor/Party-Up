"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  return createSupabaseBrowserClient(config.url, config.anonKey);
}
