import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Configurazione server incompleta" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sessione non valida" }, 401);

  // Verifica MANAGE usando la stessa sessione e le stesse policy RLS del frontend.
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .single();
  if (profileError) return json({ error: `Impossibile verificare il profilo Admin: ${profileError.message}` }, 403);
  if (!profile?.active || profile.role !== "admin") {
    return json({ error: "Permesso MANAGE richiesto" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Corpo richiesta non valido" }, 400); }
  if (body.action !== "create") return json({ error: "Azione non supportata" }, 400);

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "");
  const unitId = body.unit_id ? String(body.unit_id) : null;
  const squadId = body.squad_id ? String(body.squad_id) : null;

  if (!email || !email.includes("@")) return json({ error: "Email non valida" }, 400);
  if (password.length < 8) return json({ error: "La password temporanea deve avere almeno 8 caratteri" }, 400);
  if (!fullName) return json({ error: "Nome obbligatorio" }, 400);
  if (!["admin", "capo", "rs", "eg"].includes(role)) return json({ error: "Ruolo non valido" }, 400);
  if (role === "eg" && !squadId) return json({ error: "Un E/G deve avere una squadriglia" }, 400);

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? "Creazione utente fallita" }, 400);

  const { error: insertError } = await serviceClient.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    unit_id: unitId,
    squad_id: squadId,
    active: true,
  });
  if (insertError) {
    await serviceClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  return json({ id: created.user.id, email, full_name: fullName, role }, 201);
});
