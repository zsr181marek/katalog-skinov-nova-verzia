
/* 
   Lazy loading hodnotení a komentárov.
   Supabase a Cloudflare Turnstile sa načítajú až po kliknutí.
   Na stránke musí byť najprv načítaný js/auth-status.js.
*/

(function () {
    "use strict";

    const SUPABASE_URL = "https://dhqnvsseamfbzbdwerut.supabase.co";
    const SUPABASE_KEY = "sb_publishable_i0ewK_1lebSVchuqkJbog_XbchvjxD";
    const SITE_KEY = "0x4AAAAAAF595nZNCcL4_iSk";

    const cards = document.querySelectorAll(".skin-card");

    if (!cards.length) return;

    let supabasePromise = null;
    let turnstilePromise = null;
    let userPromise = null;

    // =========================================
    // SUPABASE – načíta sa až po kliknutí
    // =========================================

    async function getSupabase() {
        if (window.siteSupabase) {
            return window.siteSupabase;
        }

        if (!supabasePromise) {
            supabasePromise = new Promise((resolve, reject) => {

                if (window.supabase && window.supabase.createClient) {
                    resolve();
                    return;
                }

                const script = document.createElement("script");

                script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
                script.onload = resolve;
                script.onerror = () => reject(
                    new Error("Supabase knižnicu sa nepodarilo načítať.")
                );

                document.head.appendChild(script);
            }).then(() => {
                window.siteSupabase = window.siteSupabase ||
                    window.supabase.createClient(
                        SUPABASE_URL,
                        SUPABASE_KEY
                    );

                return window.siteSupabase;
            });
        }

        return supabasePromise;
    }


    // =========================================
    // CLOUDFLARE TURNSTILE – načíta sa až pri formulári
    // =========================================

    async function getTurnstile() {
        if (window.turnstile) return window.turnstile;

        if (!turnstilePromise) {
            turnstilePromise = new Promise((resolve, reject) => {

                const script = document.createElement("script");

                script.src =
                    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

                script.async = true;
                script.defer = true;

                script.onload = () => {
                    if (window.turnstile) {
                        resolve(window.turnstile);
                    } else {
                        reject(new Error("Cloudflare CAPTCHA nie je dostupná."));
                    }
                };

                script.onerror = () => {
                    reject(new Error("Cloudflare CAPTCHA sa nepodarilo načítať."));
                };

                document.head.appendChild(script);
            });
        }

        return turnstilePromise;
    }


    // =========================================
    // PRIHLÁSENÝ POUŽÍVATEĽ
    // =========================================

    async function getCurrentUser() {
        if (!userPromise) {
            userPromise = (async () => {
                const client = await getSupabase();

                const { data, error } = await client.auth.getUser();

                if (error) {
                    console.warn("Kontrola prihlásenia:", error.message);
                    return null;
                }

                return data?.user || null;
            })();
        }

        return userPromise;
    }


    // =========================================
    // POMOCNÉ FUNKCIE
    // =========================================

    function itemKey(name) {
        return name.trim()
            .toLocaleLowerCase("sk")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 120);
    }


    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[ch]));
    }


    function stars(value) {
        const n = Number(value) || 0;

        return `<span class="review-stars" aria-label="${n} z 5">${"★".repeat(n)}<span class="review-stars-empty">${"★".repeat(5 - n)}</span></span>`;
    }


    function formatCount(count) {
        if (count === 1) return "hodnotenie";
        if (count >= 2 && count <= 4) return "hodnotenia";
        return "hodnotení";
    }


    // =========================================
    // NAČÍTANIE HODNOTENÍ JEDNEJ KARTY
    // =========================================

    async function loadReviews(state) {
        const { card, name, area } = state;

        area.innerHTML = '<p class="review-loading">Načítavam hodnotenia...</p>';

        try {
            const client = await getSupabase();
            const user = await getCurrentUser();

            const key = itemKey(name);

            const { data, error } = await client
                .from("catalog_reviews")
                .select("id,item_key,item_name,rating,comment,created_at,admin_reply,admin_reply_at")
                .eq("item_key", key)
                .order("created_at", { ascending: false });

            if (error) throw error;

            state.data = data || [];
            state.user = user;

            renderReviews(state);

            state.loaded = true;

        } catch (error) {
            console.error("Načítanie hodnotení:", error);

            area.innerHTML = `
                <p class="review-error">
                    Hodnotenia sa nepodarilo načítať.
                    Skúste to znova.
                </p>
                <button type="button" class="review-retry">
                    Skúsiť znova
                </button>
            `;

            area.querySelector(".review-retry").addEventListener("click", () => {
                loadReviews(state);
            });
        }
    }


    // =========================================
    // ZOBRAZENIE HODNOTENÍ
    // =========================================

    function renderReviews(state) {
        const { area, data, user } = state;

        // Odstránenie predchádzajúcej CAPTCHA
        if (state.widgetId !== null && window.turnstile) {
            try {
                window.turnstile.remove(state.widgetId);
            } catch (e) {}
        }

        state.widgetId = null;

        const average = data.length
            ? (
                data.reduce((sum, r) => sum + Number(r.rating), 0) /
                data.length
            ).toFixed(1)
            : "—";

        const reviewsHtml = data.map(r => `
            <article class="review-entry">

                <div class="review-entry-top">
                    ${stars(r.rating)}
                    <time>${new Date(r.created_at).toLocaleDateString("sk-SK")}</time>
                </div>

                ${r.comment ? `
                    <p class="review-comment">
                        ${escapeHtml(r.comment)}
                    </p>
                ` : ""}

                ${r.admin_reply ? `
                    <div class="review-admin-reply">
                        <strong>Odpoveď správcu</strong>
                        <p>${escapeHtml(r.admin_reply)}</p>
                    </div>
                ` : ""}

            </article>
        `).join("");

        area.innerHTML = `
            <div class="review-summary">
                <strong>Hodnotenie:</strong>
                ${average}/5
                <span>(${data.length} ${formatCount(data.length)})</span>
            </div>

            ${user ? `
                <form class="review-form">

                    <label>
                        Vaše hodnotenie

                        <select name="rating" required aria-label="Počet hviezdičiek">
                            <option value="">Vyberte hviezdičky</option>
                            <option value="5">★★★★★ – výborné</option>
                            <option value="4">★★★★☆ – veľmi dobré</option>
                            <option value="3">★★★☆☆ – priemerné</option>
                            <option value="2">★★☆☆☆ – slabé</option>
                            <option value="1">★☆☆☆☆ – zlé</option>
                        </select>
                    </label>

                    <label>
                        Komentár (nepovinné)

                        <textarea name="comment"
                                  rows="3"
                                  maxlength="2000"
                                  placeholder="Napíšte svoj názor..."></textarea>
                    </label>

                    <div class="review-turnstile"></div>

                    <button type="submit" class="review-submit">
                        Odoslať hodnotenie
                    </button>

                    <p class="review-message" role="status"></p>

                </form>
            ` : `
                <p class="review-login-note">
                    <a href="/katalog-skinov-nova-verzia/prihlasenie.html">
                        Prihláste sa
                    </a>,
                    ak chcete hodnotiť alebo komentovať.
                </p>
            `}

            <div class="review-list">
                ${reviewsHtml || '<p class="review-empty">Zatiaľ bez hodnotení. Buďte prvý!</p>'}
            </div>
        `;

        if (user) {
            initializeForm(state);
        }
    }


    // =========================================
    // FORMULÁR A CAPTCHA
    // =========================================

    async function initializeForm(state) {
        const form = state.area.querySelector(".review-form");

        if (!form) return;

        const captchaContainer = form.querySelector(".review-turnstile");
        const button = form.querySelector(".review-submit");
        const message = form.querySelector(".review-message");

        try {
            const turnstile = await getTurnstile();

            // Používateľ mohol medzitým zavrieť kartu
            if (!form.isConnected) return;

            state.widgetId = turnstile.render(captchaContainer, {
                sitekey: SITE_KEY,
                theme: "auto"
            });

        } catch (error) {
            console.error("Turnstile:", error);
            message.textContent = "CAPTCHA sa nepodarilo načítať. Obnovte stránku.";
        }


        form.addEventListener("submit", async event => {
            event.preventDefault();

            message.textContent = "";

            if (!window.turnstile || state.widgetId === null) {
                message.textContent = "CAPTCHA nie je dostupná.";
                return;
            }

            const captchaToken = window.turnstile.getResponse(state.widgetId);

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
            message.textContent = "Odosielam...";

            try {
                const client = await getSupabase();

                const { data: current, error: userError } =
                    await client.auth.getUser();

                if (userError || !current?.user) {
                    throw new Error("Prihlásenie vypršalo. Prihláste sa znova.");
                }

                const { error: saveError } =
                    await client.functions.invoke("clever-handler", {
                        body: {
                            item_key: itemKey(state.name),
                            item_name: state.name,
                            rating,
                            comment: comment || null,
                            captchaToken
                        }
                    });

                if (saveError) throw saveError;

                message.textContent = "Hodnotenie bolo uložené.";

                // Znovu načítame iba hodnotenia tejto karty
                await loadReviews(state);

            } catch (error) {
                console.error("Uloženie hodnotenia:", error);

                message.textContent =
                    error.message || "Nepodarilo sa uložiť hodnotenie.";

                if (window.turnstile && state.widgetId !== null) {
                    window.turnstile.reset(state.widgetId);
                }

                button.disabled = false;
            }
        });
    }


    // =========================================
    // VYTVORENIE TLAČIDIEL PRE KARTY
    // =========================================

    cards.forEach(card => {
        const nameElement = card.querySelector(".skin-name");

        if (!nameElement) return;

        const name = nameElement.textContent.trim();

        if (!name) return;

        const body = card.querySelector(".card-body") || card;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "review-toggle";
        button.textContent = "Hodnotiť / komentovať";
        button.setAttribute("aria-expanded", "false");

        const area = document.createElement("section");
        area.className = "review-area";
        area.setAttribute("aria-label", `Hodnotenia položky ${name}`);
        area.hidden = true;

        body.appendChild(button);
        body.appendChild(area);

        const state = {
            card,
            name,
            button,
            area,
            loaded: false,
            loading: false,
            data: [],
            user: null,
            widgetId: null
        };

        button.addEventListener("click", async () => {

            // Zatvorenie
            if (!area.hidden) {
                area.hidden = true;
                button.setAttribute("aria-expanded", "false");
                button.textContent = "Hodnotiť / komentovať";
                return;
            }

            // Otvorenie
            area.hidden = false;
            button.setAttribute("aria-expanded", "true");
            button.textContent = "Skryť hodnotenia";

            // Ak už boli načítané, nepýtame ich znova
            if (state.loaded) return;

            // Zabránenie opakovanému načítaniu
            if (state.loading) return;

            state.loading = true;

            await loadReviews(state);

            state.loading = false;
        });
    });

})();
