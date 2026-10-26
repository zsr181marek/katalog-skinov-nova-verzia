/* Hodnotenia a komentáre ku kartám katalógu.
   Vyžaduje existujúci window.siteSupabase z js/auth-status.js.
   Funguje na stránkach, kde majú položky triedu .skin-card a názov .skin-name.
*/
(async function () {
  "use strict";

  const supabase = window.siteSupabase;
  if (!supabase) {
    console.warn("Hodnotenia: nenašiel sa window.siteSupabase. Skontroluj poradie skriptov.");
    return;
  }

  const cards = Array.from(document.querySelectorAll(".skin-card"));
  if (!cards.length) return;

  const { data: { user } = {} } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  function itemKey(name) {
    // Stabilný identifikátor z názvu položky; zmeny názvu neskôr treba preniesť aj do DB.
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
    const { data, error } = await supabase
      .from("catalog_reviews")
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
          <label> komentár (nepovinné)
            <textarea name="comment" rows="3" maxlength="2000" placeholder="Napíšte svoj názor…"></textarea>
          </label>
          <button type="submit" class="review-submit">Odoslať hodnotenie</button>
          <p class="review-message" role="status"></p>
        </form>` : `<p class="review-login-note"><a href="/katalog-skinov-nova-verzia/prihlasenie.html">Prihláste sa</a>, ak chcete hodnotiť alebo komentovať.</p>`}
      <div class="review-list">${reviewsHtml || '<p class="review-empty">Zatiaľ bez hodnotení. Buďte prvý!</p>'}</div>`;

    const form = target.querySelector(".review-form");
    if (form) {
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const message = form.querySelector(".review-message");
        const rating = Number(form.elements.rating.value);
        const comment = form.elements.comment.value.trim();
        const button = form.querySelector("button");
        button.disabled = true;
        message.textContent = "Odosielam…";

        const { data: current } = await supabase.auth.getUser();
        if (!current?.user) {
          message.textContent = "Prihlásenie vypršalo. Prihláste sa znova.";
          button.disabled = false;
          return;
        }

        // Jeden používateľ môže mať pre jednu položku jedno hodnotenie; ďalším odoslaním ho upraví.
        const { error: saveError } = await supabase.from("catalog_reviews").upsert({
          user_id: current.user.id,
          item_key: key,
          item_name: name,
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,item_key" });

        if (saveError) {
          message.textContent = "Nepodarilo sa uložiť hodnotenie. Skontrolujte nastavenie Supabase.";
          console.error("Uloženie hodnotenia:", saveError.message);
          button.disabled = false;
          return;
        }

        message.textContent = "Hodnotenie bolo uložené.";
        await loadReviews(card, name);
      });
    }
  }

  for (const card of cards) {
    const nameElement = card.querySelector(".skin-name");
    if (!nameElement) continue;
    const name = nameElement.textContent.trim();
    if (!name) continue;
    const area = document.createElement("section");
    area.className = "review-area";
    area.setAttribute("aria-label", `Hodnotenia položky ${name}`);
    const body = card.querySelector(".card-body") || card;
    body.appendChild(area);
    await loadReviews(card, name);
  }
})();
