(function () {
    const button = document.getElementById("themeToggle");
    const root = document.documentElement;

    let savedTheme = localStorage.getItem("theme") || "light";

    if (savedTheme !== "light" && savedTheme !== "dark") {
        savedTheme = "light";
    }

    root.setAttribute("data-theme", savedTheme);

    function updateButton(theme) {
        if (!button) return;

        button.setAttribute("aria-checked", theme === "dark" ? "true" : "false");

        button.setAttribute(
            "aria-label",
            theme === "dark" ? "Denný režim" : "Nočný režim"
        );
    }

    updateButton(savedTheme);

    if (button) {
        button.addEventListener("click", function () {
            const currentTheme = root.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";

            root.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);

            updateButton(newTheme);
        });
    }
})();