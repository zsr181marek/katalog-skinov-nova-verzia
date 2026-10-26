
(async function () {
    "use strict";

    const SUPABASE_URL =
        "https://dhqnvsseamfbzbdwerut.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_i0ewGk_1lebSVchuqkJbog_XbchvjxD";

    // Načítanie Supabase knižnice
    function loadSupabase() {
        if (window.supabase && window.supabase.createClient) {
            return Promise.resolve();
        }

        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

            script.onload = resolve;

            script.onerror = function () {
                reject(new Error("Supabase sa nepodarilo načítať."));
            };

            document.head.appendChild(script);
        });
    }

    // Vyhľadanie odkazu Prihlásenie v navbare
    function findLoginLink() {
        const links = Array.from(
            document.querySelectorAll(
                ".navbar a, nav a, .navbar-nav a"
            )
        );

        return links.find(function (link) {
            const text = (link.textContent || "")
                .trim()
                .toLocaleLowerCase("sk");

            const href = (link.getAttribute("href") || "")
                .toLocaleLowerCase("sk");

            return (
                text.includes("prihlásenie") ||
                text.includes("prihlasenie") ||
                href.includes("prihlasenie")
            );
        }) || null;
    }

    function init(client) {
        const loginLink = findLoginLink();

        if (!loginLink) {
            console.warn(
                "V navbare sa nenašiel odkaz Prihlásenie."
            );
            return;
        }

        // Vytvorenie indikátora vedľa odkazu
        let indicator = document.querySelector(
            ".auth-indicator"
        );

        if (!indicator) {
            indicator = document.createElement("span");
            indicator.className = "auth-indicator";
            indicator.setAttribute("aria-live", "polite");

            const dot = document.createElement("span");
            dot.className = "auth-dot logged-out";
            dot.setAttribute("aria-hidden", "true");

            const label = document.createElement("span");
            label.className = "auth-status-label";
            label.textContent = "Odhlásený";

            const logout = document.createElement("button");
            logout.type = "button";
            logout.className = "auth-logout";
            logout.textContent = "Odhlásiť sa";
            logout.hidden = true;

            indicator.append(dot, label, logout);

            loginLink.insertAdjacentElement(
                "afterend",
                indicator
            );

            logout.addEventListener("click", async function () {
                logout.disabled = true;
                logout.textContent = "Odhlasujem…";

                const { error } = await client.auth.signOut();

                if (error) {
                    console.error(error);

                    alert(
                        "Odhlásenie sa nepodarilo. Skús to znova."
                    );

                    logout.disabled = false;
                    logout.textContent = "Odhlásiť sa";
                    return;
                }

                window.location.href =
                    "/katalog-skinov-nova-verzia/prihlasenie.html";
            });
        }

        const dot = indicator.querySelector(".auth-dot");
        const label = indicator.querySelector(
            ".auth-status-label"
        );
        const logout = indicator.querySelector(".auth-logout");

        function render(session) {
            const loggedIn = Boolean(session);

            dot.classList.toggle("logged-in", loggedIn);
            dot.classList.toggle("logged-out", !loggedIn);

            label.textContent = loggedIn
                ? "Prihlásený"
                : "Odhlásený";

            logout.hidden = !loggedIn;

            // Odkaz Prihlásenie zostáva viditeľný
            loginLink.hidden = false;
        }

        // Overenie aktuálneho prihlásenia
        client.auth.getSession()
            .then(function ({ data, error }) {
                if (error) {
                    console.error(error);
                    render(null);
                    return;
                }

                render(data.session);
            })
            .catch(function (error) {
                console.error(error);
                render(null);
            });

        // Aktualizácia pri prihlásení a odhlásení
        client.auth.onAuthStateChange(function (
            _event,
            session
        ) {
            render(session);
        });
    }

    try {
        await loadSupabase();

        // Zdieľaný Supabase klient
        window.siteSupabase = window.siteSupabase ||
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

        init(window.siteSupabase);

    } catch (error) {
        console.error(
            "Nepodarilo sa spustiť stav prihlásenia:",
            error
        );
    }
})();
