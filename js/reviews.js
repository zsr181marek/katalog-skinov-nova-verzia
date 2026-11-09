/* Turnstile + hodnotenia katalogu.
   Na strankach musi byt najprv nacitany js/auth-status.js.
   Komentare sa ukladaju cez Supabase Edge Function submit-review,
   nie priamo cez REST tabulku. */
(async function () {
  "use strict";

  const SUPABASE_URL = "https://dhqnvsseamfbzbdwerut.supabase.co";
  const SUPABASE_KEY = "sb_publishable_i0ewGk_1lebSVchuqkJbog_XbchvjxD";

  async function ensureSupabaseClient() {
    if (window.siteSupabase) return window.siteSupabase;

    if (!window.supabase || !window.supabase.createClient) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase knižnicu sa nepodarilo načítať."));
        document.head.appendChild(script);
      });
    }

    window.siteSupabase = window.siteSupabase ||
      window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return window.siteSupabase;
  }

  let supabase;
  try {
    supabase = await ensureSupabaseClient();
  } catch (error) {
    console.error("Hodnotenia:", error);
    return;
  }

  const SITE_KEY = "0x4AAAAAAF595nZNCcL4_iSk";
  const cards = Array.from(document.querySelectorAll(".skin-card"));
  if (!cards.length) return;

  await new Promise((resolve) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.turnstile) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  const { data: { user } = {} } = await supabase.auth.getUser()
    .catch(() => ({ data: { user: null } }));

  function itemKey(name) {
    return name.trim().toLocaleLowerCase("sk")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function stars(value) {
    const n = Number(value) || 0;
    return `<span class="review-stars" aria-label="${n} z 5">${"★".repeat(n)}<span class="review-stars-empty">${"★".repeat(5 - n)}</span></span>`;
  }

  async function loadReviews(card, name) {
    const key = itemKey(name);
    const target = card.querySelector(".review-area");
    const { data, error } = await supabase.from("catalog_reviews")
      .select("id,item_key,item_name,rating,comment,created_at,admin_reply,admin_reply_at")
      .eq("item_key", key)
      .order("created_at", { ascending: false });

    if (error) {
      target.innerHTML = '<p class="review-error">Hodnotenia sa nepodarilo načítať. Skontroluj nastavenie databázy.</p>';
      console.error("Načítanie hodnotení:", error.message);
      return;
    }

    const average = data.length
      ? (data.reduce((sum, r) => sum + Number(r.rating), 0) / data.length).toFixed(1)
      : "—";
    const reviewsHtml = data.map(r => `
      <article class="review-entry">
        <div class="review-entry-top">${stars(r.rating)} <time>${new Date(r.created_at).toLocaleDateString("sk-SK")}</time></div>
        ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ""}
        ${r.admin_reply ? `<div class="review-admin-reply"><strong>Odpoveď správcu</strong><p>${escapeHtml(r.admin_reply)}</p></div>` : ""}
      </article>`).join("");

    target.innerHTML = `
      <div class="review-summary"><strong>Hodnotenie:</strong> ${average}/5 <span>(${data.length} ${data.length === 1 ? "hodnotenie" : data.length >= 2 && data.length <= 4 ? "hodnotenia" : "hodnotení"})</span></div>
      ${user ? `
        <form class="review-form">
          <label>Vaše hodnotenie
            <select name="rating" required aria-label="Počet hviezdičiek">
              <option value="">Vyberte hviezdičky</option>
              <option value="5">★★★★★ – výborné</option>
              <option value="4">★★★★☆ – veľmi dobré</option>
              <option value="3">★★★☆☆ – priemerné</option>
              <option value="2">★★☆☆☆ – slabé</option>
              <option value="1">★☆☆☆☆ – zlé</option>
            </select>
          </label>
          <label>Komentár (nepovinné)
            <textarea name="comment" rows="3" maxlength="2000" placeholder="Napíšte svoj názor…"></textarea>
          </label>
          <div class="review-turnstile"></div>
          <button type="submit" class="review-submit">Odoslať hodnotenie</button>
          <p class="review-message" role="status"></p>
        </form>` : `<p class="review-login-note"><a href="/katalog-skinov-nova-verzia/prihlasenie.html">Prihláste sa</a>, ak chcete hodnotiť alebo komentovať.</p>`}
      <div class="review-list">${reviewsHtml || '<p class="review-empty">Zatiaľ bez hodnotení. Buďte prvý!</p>'}</div>`;

    const form = target.querySelector(".review-form");
    if (!form) return;

    let widgetId = null;
    const captchaContainer = form.querySelector(".review-turnstile");
    const button = form.querySelector("button[type=submit]");
    const message = form.querySelector(".review-message");

    if (window.turnstile) {
      widgetId = turnstile.render(captchaContainer, {
        sitekey: SITE_KEY,
        theme: "auto"
      });
    } else {
      message.textContent = "CAPTCHA sa nepodarilo načítať. Obnovte stránku.";
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      message.textContent = "";

      if (widgetId === null || !window.turnstile) {
        message.textContent = "CAPTCHA nie je dostupná. Obnovte stránku.";
        return;
      }
      const captchaToken = turnstile.getResponse(widgetId);
      if (!captchaToken) {
        message.textContent = "Najprv potvrďte CAPTCHA.";
        return;
      }

      const rating = Number(form.elements.rating.value);
      const comment = form.elements.comment.value.trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        message.textContent = "Vyberte hodnotenie od 1 do 5 hviezdičiek.";
        return;
      }

      button.disabled = true;
      message.textContent = "Odosielam…";

      try {
        const { data: current, error: userError } = await supabase.auth.getUser();
        if (userError || !current?.user) {
          throw new Error("Prihlásenie vypršalo. Prihláste sa znova.");
        }

        const { error: saveError } = await supabase.functions.invoke("submit-review", {
          body: {
            item_key: key,
            item_name: name,
            rating,
            comment: comment || null,
            captchaToken
          }
        });
        if (saveError) throw saveError;

        message.textContent = "Hodnotenie bolo uložené.";
        await loadReviews(card, name);
      } catch (error) {
        console.error("Uloženie hodnotenia:", error);
        message.textContent = error.message || "Nepodarilo sa uložiť hodnotenie.";
        if (window.turnstile && widgetId !== null) turnstile.reset(widgetId);
        button.disabled = false;
      }
    });
  }

  for (const card of cards) {
    const nameElement = card.querySelector(".skin-name");
    if (!nameElement) continue;
    const name = nameElement.textContent.trim();
    if (!name) continue;
    const area = document.createElement("section");
    area.className = "review-area";
    area.setAttribute("aria-label", `Hodnotenia položky ${name}`);
    (card.querySelector(".card-body") || card).appendChild(area);
    await loadReviews(card, name);
  }
})();
