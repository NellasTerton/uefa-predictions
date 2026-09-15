// Supabase Edge Function: delete-account
// SPDX-License-Identifier: Apache-2.0
//
// Permanently removes the calling player: their auth user, profile row and
// every forecast they made (the last two go automatically through the
// ON DELETE CASCADE foreign keys).
//
// Security note: the account to delete is taken ONLY from the caller's own
// access token. The function deliberately accepts no user id in the body, so
// there is no request that can make one player delete another.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    // Resolve who is asking, from their token and nothing else.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser();

    if (authError || !user) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Count first, so the response can tell the player what was removed.
    const { count: predictionCount } = await admin
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Cascades handle profiles and predictions; delete them explicitly as well
    // so the function still cleans up if the constraints are ever changed back.
    const { error: predError } = await admin
      .from("predictions")
      .delete()
      .eq("user_id", user.id);

    if (predError) {
      throw new Error(`Failed to remove forecasts: ${predError.message}`);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileError) {
      throw new Error(`Failed to remove profile: ${profileError.message}`);
    }

    const { error: userError } = await admin.auth.admin.deleteUser(user.id);

    if (userError) {
      throw new Error(`Failed to remove account: ${userError.message}`);
    }

    return json({
      success: true,
      deletedPredictions: predictionCount ?? 0,
    });
  } catch (error) {
    console.error("delete-account failed:", (error as Error).message);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
