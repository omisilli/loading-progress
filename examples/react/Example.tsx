"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { doneLoading, initLoadingProgress, startLoading } from "@plusguard/loading-progress";
import "@plusguard/loading-progress/index.css";

/*
 * Next (App Router). The bar itself is markup in the root layout, written
 * "loading" so it runs from the first paint:
 *
 *   // app/layout.tsx
 *   <body>
 *       <div data-pg-loading-progress data-pg-loading-progress-state="loading" />
 *       <LoadingProgress />
 *       {children}
 *   </body>
 */

/* The page change is over once the route has changed — the URL is the one
   sign Next gives. The bar still waits for anything aria-busy (a
   loading.tsx skeleton) to go before it fills. */
function RouteDone() {
    const pathname = usePathname();
    const search = useSearchParams();
    useEffect(() => doneLoading(), [pathname, search]);
    return null;
}

/* Mount once, high in the tree. Starts on link clicks and fills the first
   load's bar; useSearchParams sits in its own Suspense, so the rest of the
   page still prerenders. */
export function LoadingProgress() {
    useEffect(() => initLoadingProgress(), []);
    return (
        <Suspense fallback={null}>
            <RouteDone />
        </Suspense>
    );
}

/* Links: the bar starts on the click. Timing on the link, or on anything
   above it — the nearest wins. */
export function Links() {
    return (
        <nav>
            <ul>
                <li>
                    <Link href="/videos">Videos</Link> — the defaults
                </li>
                <li>
                    <Link href="/reports" data-pg-loading-progress-duration="15000">
                        Reports
                    </Link>{" "}
                    — a slow page: a slower creep
                </li>
                <li>
                    <Link href="/search" data-pg-loading-progress-easing="linear">
                        Search
                    </Link>{" "}
                    — the same speed all the way to 90%
                </li>
                <li>
                    <Link href="/settings" data-pg-loading-progress-delay="300">
                        Settings
                    </Link>{" "}
                    — shows only if it takes longer than 0.3s
                </li>
                <li>
                    {/* The same page, another query: the bar runs, and
                        scroll={false} keeps the page where it is — a new
                        route opens at the top otherwise (Next's choice). */}
                    <Link href="?page=2" scroll={false}>
                        Page 2 of the results
                    </Link>{" "}
                    — stays where you are
                </li>
                <li data-pg-loading-progress="off">
                    <a href="/export.csv">Export</a> — a file served as a download: no bar
                </li>
                <li>
                    <a href="#comments">Comments</a> — this page: no bar
                </li>
            </ul>
        </nav>
    );
}

/* Loading skeleton for a route — app/videos/loading.tsx. aria-busy is what
   the bar waits for; any skeleton, or none, will do. */
export function VideosLoading() {
    return (
        <section aria-busy="true" aria-label="Loading videos">
            <div style={{ aspectRatio: "16 / 9", background: "rgb(127 127 127 / 0.15)" }} />
        </section>
    );
}

/* A job of your own: startLoading() returns its done(). Several at once:
   the bar fills when the last one is done. */
export function SaveButton({ save }: { save: () => Promise<void> }) {
    return (
        <button
            type="button"
            onClick={async () => {
                const done = startLoading({ duration: 6000, easing: "linear" });
                try {
                    await save();
                } finally {
                    done();
                }
            }}
        >
            Save
        </button>
    );
}

/*
 * Demo only — a made-up wait, as the static example has: a box (top left)
 * with stops from 0s to 5s, the cards' "data" taking that long, and the bar
 * timed for it. Kept in localStorage; letting go of the slider reloads the
 * page, to show the first load with it.
 *
 * The bar's timing must be there before the first paint, as the bar runs
 * from it — so a script in <head>, and a rule that hands its variables to
 * the bar:
 *
 *   // app/layout.tsx
 *   <head>
 *       <script dangerouslySetInnerHTML={{ __html: demoBarScript }} />
 *   </head>
 *
 *   html[data-demo-bar] [data-pg-loading-progress] {
 *       --pg-loading-progress-delay: var(--demo-bar-delay);
 *       --pg-loading-progress-duration: var(--demo-bar-duration);
 *       --pg-loading-progress-easing: var(--demo-bar-easing);
 *   }
 */

const WAIT_KEY = "pg-demo-wait";
const DEFAULT_WAIT = 1000;
/* Stops only. "pg": our own sites — pages in about 0.2s. */
const STOPS = [
    { ms: 0, name: "0s" },
    { ms: 200, name: "pg" },
    { ms: 500, name: "0.5s" },
    { ms: 1000, name: "1s" },
    { ms: 2500, name: "2.5s" },
    { ms: 5000, name: "5s" },
];

/* The bar for a wait of `ms`: 200ms delay, so fast pages never show it; to
   90% in about 1.2 × the wait (at least 2s), so it is near 90% when the
   page is ready, not standing there; a gentle start for long waits.
   Self-contained: also written into demoBarScript as text. */
function demoTiming(ms: number): { delay: number; duration: number; easing: string | null } {
    return {
        delay: 200,
        duration: Math.max(2000, Math.round((ms * 1.2) / 500) * 500),
        easing: ms >= 4000 ? "cubic-bezier(0.3, 0.4, 0.4, 1)" : null,
    };
}

export const demoBarScript = `(() => {
    const timing = ${demoTiming.toString()};
    let ms = ${DEFAULT_WAIT};
    try {
        const saved = localStorage.getItem("${WAIT_KEY}");
        if (saved !== null && ${JSON.stringify(STOPS.map((s) => s.ms))}.includes(Number(saved))) ms = Number(saved);
    } catch {}
    const t = timing(ms);
    const root = document.documentElement.style;
    root.setProperty("--demo-bar-delay", t.delay + "ms");
    root.setProperty("--demo-bar-duration", t.duration + "ms");
    if (t.easing) root.setProperty("--demo-bar-easing", t.easing);
    document.documentElement.setAttribute("data-demo-bar", "");
})();`;

function readWait(): number {
    try {
        const saved = localStorage.getItem(WAIT_KEY);
        if (saved !== null && STOPS.some((s) => s.ms === Number(saved))) return Number(saved);
    } catch {
        // No storage: the default.
    }
    return DEFAULT_WAIT;
}

/* The wait — null on the server, which cannot read localStorage: the box
   is drawn only once it is known, so it never shows a wrong one. */
function useDemoWait(): number | null {
    return useSyncExternalStore(
        () => () => {},
        readWait,
        () => null,
    );
}

const seconds = (ms: number) => `${Number((ms / 1000).toFixed(2))}s`;

export function DemoWait() {
    const wait = useDemoWait();
    const [held, setHeld] = useState<number | null>(null);
    if (wait === null) return null;

    const now = held ?? STOPS.findIndex((s) => s.ms === wait);
    const stop = STOPS[now];
    const t = demoTiming(stop.ms);
    const save = (i: number) => {
        try {
            localStorage.setItem(WAIT_KEY, String(STOPS[i].ms));
        } catch {
            // No storage: nothing to keep.
        }
        location.reload();
    };

    return (
        <aside aria-label="Made-up wait" style={{ position: "fixed", top: 16, left: 16, zIndex: 10, width: "36ch", font: "11px/1.5 ui-monospace, monospace" }}>
            <p style={{ whiteSpace: "pre" }}>
                {`server wait : ${seconds(stop.ms)}${stop.name === "pg" ? " · plusguard" : ""}\n`}
                {`bar delay   : ${t.delay}ms\n`}
                {`bar to 90%  : ${seconds(t.duration)}\n`}
                {`bar start   : ${t.easing ? "gentle" : "fast"}`}
            </p>
            <p style={{ opacity: 0.6 }}>made up — demo only</p>
            {/* While held: show; let go (pointer up, or a key): keep and reload. */}
            <input
                type="range"
                min={0}
                max={STOPS.length - 1}
                step={1}
                value={now}
                aria-label="Server wait"
                onChange={(e) => setHeld(Number(e.target.value))}
                onPointerUp={(e) => save(Number(e.currentTarget.value))}
                onKeyUp={(e) => save(Number(e.currentTarget.value))}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                {STOPS.map((s, i) => (
                    <button key={s.ms} type="button" aria-pressed={i === now} onClick={() => save(i)}>
                        {s.name}
                    </button>
                ))}
            </div>
        </aside>
    );
}

/* The cards: aria-busy until their made-up "data" arrives — the bar waits
   for them, on the first load and after every page change. */
export function DemoCards() {
    const wait = useDemoWait();
    const [busy, setBusy] = useState(true);
    useEffect(() => {
        if (wait === null) return;
        const timer = setTimeout(() => setBusy(false), wait);
        return () => clearTimeout(timer);
    }, [wait]);

    return (
        <div aria-busy={busy} aria-label="Loading cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {["One", "Two", "Three"].map((name) => (
                <div key={name} style={{ height: 96, borderRadius: 12, background: "rgb(127 127 127 / 0.15)" }}>
                    {busy ? null : name}
                </div>
            ))}
        </div>
    );
}
