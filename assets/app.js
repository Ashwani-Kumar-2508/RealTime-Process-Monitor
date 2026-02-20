const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector(".nav");
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");

function setTheme(mode) {
    root.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
}

function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    if (saved) {
        setTheme(saved);
        return;
    }
    setTheme(prefersLight ? "light" : "dark");
}

function highlightActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    document.querySelectorAll(".nav a").forEach((link) => {
        if (link.dataset.page === page) {
            link.classList.add("is-active");
        }
    });
}

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        setTheme(next);
    });
}

if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
        nav.classList.toggle("is-open");
    });
}

if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (formStatus) {
            formStatus.textContent = "Sending...";
        }

        const formData = new FormData(contactForm);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await fetch("/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Failed to submit");
            if (formStatus) {
                formStatus.textContent = "Thanks! Your message has been sent.";
            }
            contactForm.reset();
        } catch (error) {
            if (formStatus) {
                formStatus.textContent = "Unable to send right now. Please try again.";
            }
        }
    });
}

initTheme();
highlightActiveNav();
