import "server-only";

import { createClient } from "@supabase/supabase-js";

// The service_role key bypasses RLS and must never reach the browser. The
// `server-only` import above turns any accidental client import into a build
// error, and the env vars deliberately have no NEXT_PUBLIC_ prefix so Next
// won't inline them into the bundle.

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && serviceRoleKey);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-service-role-key",
  { auth: { persistSession: false, autoRefreshToken: false } }
);
