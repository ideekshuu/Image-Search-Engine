/*
 * Frame Finder — Unsplash image search
 *
 * Note: the Unsplash access key below is exposed on the client, which is
 * fine for a demo/portfolio project. For a real deployment, proxy requests
 * through a small backend so the key isn't visible in the page source.
 */

const accessKey = "CXmgb2XzQuV1ZzP6SQF5EOtjGrmA2PmLrAuJAw1WvVA";
const PER_PAGE = 12;
const HISTORY_KEY = "frameFinderHistory";
const THEME_KEY = "frameFinderTheme";

const formEl = document.getElementById("search-form");
const inputEl = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const resultsEl = document.getElementById("search-results");
const statusEl = document.getElementById("status-message");
const sentinel = document.getElementById("sentinel");
const endMessage = document.getElementById("end-message");
const historyRow = document.getElementById("history-row");
const historyList = document.getElementById("history-list");
const historyClear = document.getElementById("history-clear");
const themeToggle = document.getElementById("theme-toggle");

let currentQuery = "";
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let frameCounter = 0;

/* ---------------- Theme ---------------- */

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
        applyTheme(saved);
        return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
}

themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
});

/* ---------------- Search history ---------------- */

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function addToHistory(query) {
    let history = loadHistory().filter((q) => q.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    history = history.slice(0, 5);
    saveHistory(history);
    renderHistory();
}

function removeFromHistory(query) {
    saveHistory(loadHistory().filter((q) => q !== query));
    renderHistory();
}

function renderHistory() {
    const history = loadHistory();
    historyList.innerHTML = "";

    if (history.length === 0) {
        historyRow.hidden = true;
        return;
    }
    historyRow.hidden = false;

    history.forEach((query) => {
        const chip = document.createElement("div");
        chip.className = "history-chip";

        const label = document.createElement("button");
        label.type = "button";
        label.className = "chip-label";
        label.textContent = query;
        label.addEventListener("click", () => {
            inputEl.value = query;
            runSearch(query);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chip-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove "${query}" from history`);
        remove.addEventListener("click", () => removeFromHistory(query));

        chip.appendChild(label);
        chip.appendChild(remove);
        historyList.appendChild(chip);
    });
}

historyClear.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
});

/* ---------------- Skeleton placeholders ---------------- */

function renderSkeletons(count) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const card = document.createElement("div");
        card.className = "skeleton-card";
        card.innerHTML = `
            <div class="frame-media"></div>
            <div class="skeleton-line" style="width: 70%;"></div>
            <div class="skeleton-line" style="width: 40%;"></div>
        `;
        fragment.appendChild(card);
    }
    resultsEl.appendChild(fragment);
}

function clearSkeletons() {
    resultsEl.querySelectorAll(".skeleton-card").forEach((node) => node.remove());
}

/* ---------------- Rendering a result card ---------------- */

function renderResult(result) {
    frameCounter += 1;

    const card = document.createElement("div");
    card.className = "search-result";

    const frameNumber = document.createElement("span");
    frameNumber.className = "frame-number";
    frameNumber.textContent = String(frameCounter).padStart(2, "0");

    const media = document.createElement("div");
    media.className = "frame-media";

    const img = document.createElement("img");
    img.src = result.urls.small;
    img.alt = result.alt_description || result.description || "Untitled photo";
    img.loading = "lazy";

    const actions = document.createElement("div");
    actions.className = "frame-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "frame-action";
    downloadBtn.setAttribute("aria-label", "Download image");
    downloadBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>`;
    downloadBtn.addEventListener("click", () => downloadImage(result, downloadBtn));

    actions.appendChild(downloadBtn);
    media.appendChild(img);
    media.appendChild(actions);

    const caption = document.createElement("div");
    caption.className = "frame-caption";

    const link = document.createElement("a");
    link.href = `${result.links.html}?utm_source=frame_finder&utm_medium=referral`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = result.alt_description || result.description || "View photo";

    const credit = document.createElement("a");
    credit.className = "frame-credit";
    credit.href = `${result.user.links.html}?utm_source=frame_finder&utm_medium=referral`;
    credit.target = "_blank";
    credit.rel = "noopener";
    credit.textContent = `by ${result.user.name}`;

    caption.appendChild(link);
    caption.appendChild(credit);

    card.appendChild(frameNumber);
    card.appendChild(media);
    card.appendChild(caption);

    resultsEl.appendChild(card);
}

/* ---------------- Download ---------------- */

async function downloadImage(result, button) {
    button.classList.add("is-busy");
    try {
        // Unsplash API guidelines require pinging download_location whenever
        // a photo is downloaded, so usage gets tracked correctly.
        fetch(`${result.links.download_location}&client_id=${accessKey}`).catch(() => {});

        const response = await fetch(result.urls.regular);
        if (!response.ok) throw new Error("Image fetch failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const slug = (result.alt_description || result.id || "frame")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 40);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${slug || "frame"}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        // Fall back to opening the photo page if the blob download is blocked.
        window.open(result.links.html, "_blank", "noopener");
    } finally {
        button.classList.remove("is-busy");
    }
}

/* ---------------- Fetching pages ---------------- */

async function fetchPage(query, page, { append }) {
    isLoading = true;
    searchButton.disabled = true;
    statusEl.textContent = "";
    statusEl.classList.remove("is-error");
    endMessage.hidden = true;

    if (!append) {
        resultsEl.innerHTML = "";
        frameCounter = 0;
    }
    renderSkeletons(append ? 4 : PER_PAGE);

    try {
        const url = `https://api.unsplash.com/search/photos?page=${page}&per_page=${PER_PAGE}&query=${encodeURIComponent(query)}&client_id=${accessKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            const message = (data && data.errors && data.errors[0]) || "Something went wrong.";
            throw new Error(message);
        }

        clearSkeletons();

        if (page === 1 && data.results.length === 0) {
            statusEl.textContent = `No frames found for "${query}". Try a different search.`;
            totalPages = 1;
            return;
        }

        data.results.forEach(renderResult);
        totalPages = data.total_pages;

        if (page >= totalPages) {
            endMessage.hidden = false;
        }
    } catch (error) {
        clearSkeletons();
        statusEl.textContent = `Couldn't load results — ${error.message}`;
        statusEl.classList.add("is-error");
    } finally {
        isLoading = false;
        searchButton.disabled = false;
    }
}

function runSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) return;
    currentQuery = trimmed;
    currentPage = 1;
    addToHistory(trimmed);
    fetchPage(currentQuery, currentPage, { append: false });
}

formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(inputEl.value);
});

/* ---------------- Infinite scroll ---------------- */

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && !isLoading && currentQuery && currentPage < totalPages) {
                currentPage += 1;
                fetchPage(currentQuery, currentPage, { append: true });
            }
        });
    },
    { rootMargin: "200px" }
);

observer.observe(sentinel);

/* ---------------- Init ---------------- */

initTheme();
renderHistory();
