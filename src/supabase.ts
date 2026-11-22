import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://bbyvesvjttnkkgjbgetv.supabase.co",
  "sb_publishable_Nn8zk9ivlDvSVz6JDktpsw_v8pykc7C",
  {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }
);
