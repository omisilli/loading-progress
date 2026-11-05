/*
 * loading-progress — a thin bar along the top of the page while something
 * loads, as YouTube shows.
 *
 *   <div data-pg-loading-progress data-pg-loading-progress-state="loading"></div>
 *
 * The state, on the bar: none (idle) · "loading" · "done". Written
 * "loading" in the HTML, the bar runs from the very first paint — the creep
 * is CSS — and this script finishes it once the page is ready.
 *
 * Starts on: a click on a link to another page of this site; a form sent
 * the browser's own way; startLoading(). Not on: a new tab or window,
 * another site, a download, a #hash on this page, the page you are on, or
 * anything inside data-pg-loading-progress="off".
 *
 * It cannot know how long anything will take — nobody can. It creeps, fast
 * then slow, and never reaches the end on its own. It fills only when the
 * page is ready: the page change is over (on a static site, the next page
 * itself; on Next, doneLoading() once the route has changed), every
 * startLoading() job is done, the page has loaded, and nothing is
 * aria-busy="true" any more — skeletons gone. Full means ready.
 *
 * Timing — on a link, a form or anything above them (the nearest wins), on
 * the bar for every run the script starts, or in startLoading({…}):
 *   data-pg-loading-progress-delay      ms before it shows. 0
 *   data-pg-loading-progress-duration   ms to creep to 90%. 3000
 *   data-pg-loading-progress-easing     the creep's curve. Fast, then slow
 *   data-pg-loading-progress-finish     ms to fill once ready. 200
 */

const ATTR = "data-pg-loading-progress";
const STATE = "data-pg-loading-progress-state";
const TIMING = {
    delay: "data-pg-loading-progress-delay",
    duration: "data-pg-loading-progress-duration",
    easing: "data-pg-loading-progress-easing",
    finish: "data-pg-loading-progress-finish",
} as const;

/* How long to wait for "ready" before filling anyway — an aria-busy that
   never clears must not leave the bar creeping for ever. */
const READY_TIMEOUT = 15000;
/* Where a static site's page change is handed to the next page. */
const STORE = "pg-loading-progress";

export type LoadingTiming = {
    /* ms before the bar shows. */
    delay?: number;
    /* ms to creep to 90%. */
    duration?: number;
    /* the creep's curve: "linear", "ease-out", "cubic-bezier(…)". */
    easing?: string;
    /* ms to fill once ready. */
    finish?: number;
};

let bar: HTMLElement | null = null;
/* The bar's own timing attributes: the default for every run. */
let base: LoadingTiming = {};
/* A page change under way — a link or a form. */
let navigating = false;
/* When it started, and on what timing — for the next page to carry on
   with (static sites). */
let navigatedAt = 0;
let navTiming: LoadingTiming = {};
/* startLoading() jobs not yet done. */
let jobs = 0;
let waiting = false;
let clearTimer = 0;

function findBar(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[${ATTR}=""], [${ATTR}="true"]`);
}

function ms(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/* Timing from an element's own attributes, or the nearest above it. */
function timingOf(el: Element): LoadingTiming {
    const read = (attr: string): string | undefined => el.closest(`[${attr}]`)?.getAttribute(attr) || undefined;
    return {
        delay: ms(read(TIMING.delay)),
        duration: ms(read(TIMING.duration)),
        easing: read(TIMING.easing),
        finish: ms(read(TIMING.finish)),
    };
}

function setVar(name: string, value: string | undefined): void {
    if (!bar) return;
    if (value === undefined) bar.style.removeProperty(name);
    else bar.style.setProperty(name, value);
}

/* A run's timing, written to the bar for index.css: what the run does not
   set falls back to the bar's attributes, then to the CSS. */
function applyTiming(t: LoadingTiming): void {
    const pick = <K extends keyof LoadingTiming>(key: K): LoadingTiming[K] => t[key] ?? base[key];
    const time = (n: number | undefined): string | undefined => (n === undefined ? undefined : `${n}ms`);
    setVar("--pg-loading-progress-delay", time(pick("delay")));
    setVar("--pg-loading-progress-duration", time(pick("duration")));
    setVar("--pg-loading-progress-easing", pick("easing"));
    setVar("--pg-loading-progress-finish", time(pick("finish")));
}

/* elapsed: how long the run has been going already — on the page before. */
function begin(t: LoadingTiming, elapsed = 0): void {
    if (!bar) return;
    clearTimeout(clearTimer);
    applyTiming(t);
    setVar("--pg-loading-progress-elapsed", elapsed ? `${elapsed}ms` : undefined);
    // Drop the state for a frame, so the creep starts over from nothing.
    bar.removeAttribute(STATE);
    void bar.offsetWidth;
    bar.setAttribute(STATE, "loading");
}

const isReady = (): boolean =>
    document.readyState === "complete" && document.querySelector('[aria-busy="true"]') === null;

/* Run `then` once the page has loaded and nothing is aria-busy. */
function whenReady(then: () => void): void {
    if (isReady()) return then();
    let over = false;
    const end = (): void => {
        if (over) return;
        over = true;
        mo.disconnect();
        removeEventListener("load", check);
        clearTimeout(timer);
        then();
    };
    const check = (): void => {
        if (isReady()) end();
    };
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-busy"],
    });
    addEventListener("load", check);
    const timer = window.setTimeout(end, READY_TIMEOUT);
}

/* "0.3s, 0s" or "300ms" → the longest, in ms. */
function longest(list: string): number {
    return Math.max(0, ...list.split(",").map((s) => parseFloat(s) * (s.trim().endsWith("ms") ? 1 : 1000) || 0));
}

/* Fill — once the page is ready, and nothing else has started meanwhile. */
function complete(): void {
    if (!bar || waiting || navigating || jobs > 0 || bar.getAttribute(STATE) !== "loading") return;
    waiting = true;
    whenReady(() => {
        waiting = false;
        if (!bar || navigating || jobs > 0 || bar.getAttribute(STATE) !== "loading") return;
        // Ready before its delay was up: it never showed, and never will.
        if (getComputedStyle(bar).opacity === "0") {
            bar.removeAttribute(STATE);
            return;
        }
        // Fill from wherever the creep has got to.
        const at = parseFloat(getComputedStyle(bar, "::before").scale);
        bar.style.setProperty("--pg-loading-progress-from", String(Number.isFinite(at) ? at : 0));
        bar.setAttribute(STATE, "done");
        // Back to idle once filled and faded — the times index.css gives.
        const style = getComputedStyle(bar);
        const total = longest(style.transitionDelay) + longest(style.transitionDuration);
        clearTimer = window.setTimeout(() => {
            if (bar?.getAttribute(STATE) === "done") bar.removeAttribute(STATE);
        }, total + 50);
    });
}

/*
 * Start the bar for a job of your own; returns its done(). Several jobs at
 * once: the bar fills when the last one is done.
 *
 *   const done = startLoading({ duration: 15000, easing: "linear" });
 *   await fetch(…);
 *   done();
 */
export function startLoading(timing: LoadingTiming = {}): () => void {
    if (typeof document === "undefined") return () => {};
    bar ??= findBar();
    jobs++;
    if (bar?.getAttribute(STATE) !== "loading") begin(timing);
    let called = false;
    return () => {
        if (called) return;
        called = true;
        jobs = Math.max(0, jobs - 1);
        complete();
    };
}

/* The page change is over — on Next, call it when the route has changed.
   The bar still waits for the page to be ready, and for your
   startLoading() jobs, before it fills. */
export function doneLoading(): void {
    if (typeof document === "undefined") return;
    navigating = false;
    complete();
}

/* A click on this link takes the browser to another page of this site. */
function leavesForPage(a: HTMLAnchorElement, event: MouseEvent): boolean {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
    const url = new URL(a.href, location.href);
    // Another site, or mailto:, tel:, javascript: — no page of this site.
    if (url.protocol !== location.protocol || url.origin !== location.origin) return false;
    // The same page, or only its #hash: no page change.
    return url.pathname !== location.pathname || url.search !== location.search;
}

const off = (el: Element): boolean => el.closest(`[${ATTR}="off"]`) !== null;

function navigate(from: Element): void {
    navigating = true;
    navigatedAt = Date.now();
    navTiming = timingOf(from);
    begin(navTiming);
}

/* Only the newest call answers events — a late cleanup from an older one
   (React remounting) cannot switch it off. Same rule as the other packages. */
let live: object | null = null;

/* Start listening — and fill a first-load bar, written "loading" in the
   HTML, once the page is ready. Returns the cleanup, for a React effect. */
export function initLoadingProgress(): () => void {
    if (typeof document === "undefined") return () => {};

    const self = {};
    live = self;
    bar = findBar();
    if (bar) {
        bar.setAttribute("aria-hidden", "true");
        base = timingOf(bar);

        // A static site's page change, handed over by the page before.
        let handed: { at: number; timing: LoadingTiming } | null = null;
        try {
            handed = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
            sessionStorage.removeItem(STORE);
        } catch {
            // No storage (private mode, blocked): it starts over.
        }
        const elapsed = handed ? Date.now() - handed.at : -1;

        if (bar.getAttribute(STATE) === "loading") {
            if (handed && elapsed >= 0 && elapsed < READY_TIMEOUT) {
                // Carry on with the link's timing, from where it was.
                begin(handed.timing, elapsed);
            } else {
                // The first load: creeping since the first paint on the
                // CSS's times — changing them midway would make it jump.
                // The fill time is safe to set.
                const finish = base.finish;
                setVar("--pg-loading-progress-finish", finish === undefined ? undefined : `${finish}ms`);
            }
            complete();
        }
    }

    const onClick = (event: MouseEvent): void => {
        if (live !== self || !(event.target instanceof Element)) return;
        const a = event.target.closest("a[href]");
        if (!(a instanceof HTMLAnchorElement) || off(a) || !leavesForPage(a, event)) return;
        navigate(a);
    };

    const onSubmit = (event: SubmitEvent): void => {
        // Sent by a script of yours (fetch): not a page change.
        if (live !== self || event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
        const form = event.target;
        const by = event.submitter;
        const target = by?.getAttribute("formtarget") ?? form.target;
        const method = (by?.getAttribute("formmethod") ?? form.method).toLowerCase();
        if ((target && target !== "_self") || method === "dialog" || off(by ?? form)) return;
        navigate(by ?? form);
    };

    // The page is being left mid-change: hand the start to the next page.
    const onPageHide = (): void => {
        if (live !== self || !navigating) return;
        try {
            sessionStorage.setItem(STORE, JSON.stringify({ at: navigatedAt, timing: navTiming }));
        } catch {
            // No storage: the next page starts over.
        }
    };

    // Back from the browser's page cache, frozen mid-run: start clean.
    const onPageShow = (event: PageTransitionEvent): void => {
        if (live !== self || !event.persisted || !bar) return;
        navigating = false;
        jobs = 0;
        bar.removeAttribute(STATE);
        try {
            sessionStorage.removeItem(STORE);
        } catch {
            // Nothing to clear.
        }
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    addEventListener("pagehide", onPageHide);
    addEventListener("pageshow", onPageShow);

    return () => {
        document.removeEventListener("click", onClick);
        document.removeEventListener("submit", onSubmit);
        removeEventListener("pagehide", onPageHide);
        removeEventListener("pageshow", onPageShow);
        if (live === self) live = null;
    };
}
