
(() => {
    const SUPABASE_URL =
        "https://dhqnvsseamfbzbdwerut.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_i0ewGk_1lebSVchuqkJbog_XbchvjxD";

    if (!window.supabase) return;

    // Použi existujúceho klienta, ak ho stránka už vytvorila.
    const client = window.siteSupabase ||
        (window.siteSupabase = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        ));

    let indicator = null;

    function showIndicator(session) {
        if (!session) {
            if (indicator) {
                indicator.remove();
                indicator = null;
            }
            return;
        }

        if (indicator) return;

        indicator = document.createElement("div");
        indicator.className = "auth-indicator";

        indicator.innerHTML = `
            <span class="auth-dot"></span>
            <span>Prihlásený</span>
            <button type="button" class="auth-logout">
                Odhlásiť sa
            </button>
        `;

        document.body.appendChild(indicator);

        indicator.querySelector(".auth-logout")
            .addEventListener("click", async () => {
                const button =
                    indicator.querySelector(".auth-logout");

                button.disabled = true;
                button.textContent = "Odhlasujem...";

                const { error } = await client.auth.signOut();

                if (error) {
                    alert("Odhlásenie sa nepodarilo.");
                    button.disabled = false;
                    button.textContent = "Odhlásiť sa";
                    return;
                }

                window.location.href = "prihlasenie.html";
            });
    }

    client.auth.getSession().then(({ data, error }) => {
        if (!error) showIndicator(data.session);
    });

    client.auth.onAuthStateChange((_event, session) => {
        showIndicator(session);
    });
})();
