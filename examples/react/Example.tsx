"use client";

import { Suspense, useEffect } from "react";
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
                    <Link href="/reports" data-pg-loading-progress-duration="30000">
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
