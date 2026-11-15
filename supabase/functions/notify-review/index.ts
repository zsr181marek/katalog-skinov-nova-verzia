// Voliteľná Supabase Edge Function na e-mailové upozornenia cez Resend.
// Nastavte secrets: RESEND_API_KEY, ADMIN_EMAIL, SITE_URL.
// Pripojte ju cez Database Webhook na INSERT/UPDATE public.catalog_reviews.
// Webhook musí posielať JSON payload s record a old_record (štandardný Supabase webhook).
// Pred produkčným použitím nastavte overenie webhooku podľa svojho spôsobu nasadenia.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://zsr181marek.github.io/katalog-skinov-nova-verzia/";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Katalóg skinov <onboarding@resend.dev>",
      to: [to],
      subject,
      html
    })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}: ${await response.text()}`);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record ?? null;
    if (!record) return new Response("Missing record", { status: 400 });

    const isNewReview = payload.type === "INSERT" || !oldRecord;
    const replyChanged = !isNewReview && record.admin_reply && record.admin_reply !== oldRecord.admin_reply;
    const item = String(record.item_name ?? "Položka katalógu");
    const comment = String(record.comment ?? "");
    const safe = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

    if (isNewReview && ADMIN_EMAIL) {
      await sendEmail(ADMIN_EMAIL, `Nový komentár: ${item}`,
        `<h2>Nové hodnotenie v katalógu</h2><p><b>Položka:</b> ${safe(item)}</p><p><b>Hodnotenie:</b> ${record.rating}/5</p><p><b>Komentár:</b><br>${safe(comment)}</p><p><a href="${SITE_URL}admin.html">Otvoriť administráciu</a></p>`);
    }

    // Email používateľovi pri odpovedi vyžaduje bezpečné získanie e-mailu autora.
    // Do databázy sa e-mail autora zámerne nekopíruje. V produkcii doplňte
    // overený serverový lookup cez Supabase Admin API pomocou SUPABASE_SERVICE_ROLE_KEY
    // ako Edge Function secret a nikdy tento kľúč nevkladajte do HTML/JS.
    if (replyChanged) {
      console.log("Admin reply detected for review", record.id, "— configure secure author email lookup to notify user.");
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response("Notification failed", { status: 500 });
  }
});
