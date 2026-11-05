# loading-progress

A thin bar along the top of the page while something loads — the red line
YouTube shows. It runs from the very first paint, on every page change,
and for any job of your own, and fills only once the page is ready. Timing
from HTML attributes; Next and static sites alike; no dependencies.

```html
<div data-pg-loading-progress data-pg-loading-progress-state="loading"></div>
```

```sh
npm install github:omisilli/loading-progress#v1.3.0
```

```ts
import { initLoadingProgress } from "@plusguard/loading-progress";
import "@plusguard/loading-progress/index.css";

initLoadingProgress();
```

Or the CSS from CSS, which lets you pick the cascade layer:

```css
@import "@plusguard/loading-progress/index.css" layer(components);
```

### Without a build step

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/loading-progress@v1.3.0/index.css" />
<script type="module">
    import { initLoadingProgress } from "https://cdn.jsdelivr.net/gh/omisilli/loading-progress@v1.3.0/dist/index.js";
    initLoadingProgress();
</script>
```

Pin the version (`@v1.3.0`) on a live site. A pinned URL never changes;
`@1` follows the newest 1.x release.

## How long? Nobody knows

A browser cannot tell how long a page will take — not the next page's
size, not the server's speed, not your data. No loading bar knows; they
all pretend. This one pretends the way YouTube does: it **creeps** —
quickly at first, then slower and slower, towards 90% — and **never gets
further by itself**. When the page is ready it fills the rest, quickly,
and fades.

So the bar's position means nothing; **full means ready**. "Ready" is:

| What is loading               | Ready when                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| The first load of a page      | The page has loaded (`load`) **and** nothing is `aria-busy="true"` any more                  |
| A page change on Next         | The route has changed (`doneLoading()`, see [Next](#next)) **and** nothing is `aria-busy`  |
| A page change on a static site | The next page has loaded **and** nothing is `aria-busy` there — it carries on from where it was |
| A job of your own             | Its `done()` is called — every one of them, if several run at once                          |

Each case waits for all of them: a page change while your own job runs
fills when both are over. However long the change itself takes — a slow
server, a big page — the bar waits at 90% (see [The duration is not the
page's time](#the-duration-is-not-the-pages-time)). After that, the wait
for `load` and `aria-busy` has a limit: 15 seconds. An image that never
finishes, or an `aria-busy` left on by mistake, does not hold the bar for
ever.

## The first load

Write the bar with `data-pg-loading-progress-state="loading"` in the HTML:

```html
<body>
    <div data-pg-loading-progress data-pg-loading-progress-state="loading"></div>
    …
</body>
```

The creep is CSS, so the bar runs from the first paint — before any script
has loaded, in a new tab too. The script, once it runs, waits for the page
to be ready and fills it. Leave the state out and the bar is idle until the
first page change.

Once, anywhere in the page. It is fixed to the top, over everything, takes
no clicks, and is hidden from screen readers.

## When it starts

- **A click on a link to another page of this site** — same origin, a
  different path or query.
- **A form sent the browser's own way** — not one your script sends with
  `fetch` (`preventDefault`).
- **`startLoading()`**, for anything else.

Not on: a link to another site, a new tab or window (`target="_blank"`, or
Ctrl/⌘/Shift/middle-click), a `download`, a `#hash` on this page, the page
you are on, or `mailto:` and the like.

Not on anything inside `data-pg-loading-progress="off"` either — on the
link, the form, or anything above them:

```html
<a href="/export.csv" data-pg-loading-progress="off">Export</a>
```

Use it for a link the browser downloads without leaving the page (a file
served as an attachment), which would leave the bar creeping. On a static
site it stops only the click's bar: the next page's own first load still
shows its bar.

## Timing

Four attributes. On a link, a form, its button, or anything above them —
the nearest wins — for that one start; on the bar itself, for every run the
script starts.

| Attribute                           | Default            | What                                                           |
| ----------------------------------- | ------------------ | -------------------------------------------------------------- |
| `data-pg-loading-progress-delay`    | `0`                | ms before it shows. Ready sooner: it never shows               |
| `data-pg-loading-progress-duration` | `2000`             | ms to creep to 90%                                             |
| `data-pg-loading-progress-easing`   | fast, then slow    | The creep's curve: `linear`, `ease-out`, `cubic-bezier(…)`     |
| `data-pg-loading-progress-finish`   | `200`              | ms to fill once ready (the fade, 0.2s, follows)                |

```html
<!-- A search that takes a while: a slower, steady creep. -->
<form action="/search" data-pg-loading-progress-duration="15000" data-pg-loading-progress-easing="linear">
    <input name="q" />
    <button>Search</button>
    <!-- The button's own, for this button. -->
    <button name="quick" value="1" data-pg-loading-progress-duration="1000">Quick search</button>
</form>

<!-- Every link in the menu: only if it takes longer than 0.3s. -->
<nav data-pg-loading-progress-delay="300">…</nav>
```

### Always, or only when slow — the delay

The one choice to make for a site. Two ways to run the bar:

| `delay`              | The bar shows                                            | Fits                                                         |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `0` — the default    | On every page change, at once — within a frame of the click | Pages that take most of a second or more, as on YouTube: the bar is the answer to the click |
| `200`, `300` …       | Only when a change takes longer than that; never before  | A fast site — Next prefetches its links and pages change in a fifth of a second: the bar is a warning that this one is slow |

**With no delay on a fast site**, the bar flashes on every click — in,
full, out in under half a second — and says nothing: the page was there
anyway. **With a delay**, it stays away from the fast changes and shows
only when something holds the page up: a slow network, a phone, a heavy
page, a busy server. Then it means something.

Measure your own site before you choose. A change that ends just after the
delay shows the bar briefly; if many of yours land there, a little more
delay keeps them quiet. Much beyond 300ms, the bar starts to feel late
when it does show.

For every page change and the first load alike, set it as a CSS variable
(see [For the first load](#for-the-first-load)):

```css
[data-pg-loading-progress] {
    --pg-loading-progress-delay: 200ms;
}
```

For one link or one part of the page, the attribute:

```html
<a href="/dashboard" data-pg-loading-progress-delay="0">Dashboard — always show</a>
```

### The duration is not the page's time

`duration` is how long the creep takes to reach 90% — not how long the
page takes. Nobody knows that (see [How long? Nobody
knows](#how-long-nobody-knows)). The default, 2 seconds:

| After        | 0.2s | 0.5s | 1s  | 1.5s | 2s  | 10s |
| ------------ | ---- | ---- | --- | ---- | --- | --- |
| The defaults | 41%  | 66%  | 83% | 89%  | 90% | 90% |

**When the server is slow** — the page takes 10 seconds — the bar reaches
90% at 2 seconds and **stops there until the page is really ready**. It
does not fill by itself and does not go back; it fills only when the
page is there. A bar standing still at 90% is honest — the page is not
ready — but it looks stuck. For a page you know is slow, a longer
`duration` keeps it moving all the way:

```html
<a href="/reports/yearly" data-pg-loading-progress-duration="15000">The yearly report</a>
```

A page that never arrives — the server does not answer — leaves the bar at
90% until the browser gives up and shows its own error page. The one time
limit comes after: once the page has arrived, waiting for `load` and
`aria-busy` stops after 15 seconds.

### For the first load

The first load's creep starts before any script, so the attributes cannot
reach it. Set the CSS variables instead — they are the defaults for every
run, which the attributes then override:

```css
[data-pg-loading-progress] {
    --pg-loading-progress-duration: 8s;
}
```

`-delay`, `-duration`, `-easing` and `-finish` all have a variable of the
same name.

## Jobs of your own

`startLoading()` starts the bar and returns its `done()`:

```ts
import { startLoading } from "@plusguard/loading-progress";

const done = startLoading();
const results = await fetch("/api/search?q=horses").then((r) => r.json());
done();
```

The same four timings, in milliseconds:

```ts
const done = startLoading({ duration: 15000, easing: "linear", delay: 200, finish: 500 });
```

Nothing changes page, so nothing scrolls: the page stays where it is —
use it for a button that fetches data, "load more", a filter, a form your
script sends. In React, the same around a state update:

```tsx
async function loadMore() {
    const done = startLoading();
    try {
        setVideos(await fetchVideos());
    } finally {
        done();
    }
}
```

Several at once — the bar fills when the last `done()` is called. Calling a
`done()` twice does nothing. After the last one, it still waits for nothing
to be `aria-busy`.

## With skeleton

[skeleton](https://github.com/omisilli/skeleton) draws grey stand-ins
where content is still coming; this bar says the page as a whole is still
coming. Together they are YouTube's page: the bar along the top, the grey
cards below — and the bar fills only when the cards have gone.

The link between them is `aria-busy="true"`, which you put on a skeleton's
part anyway, for screen readers. Nothing else: neither package knows the
other, and each works alone — the bar without skeletons fills once the
page has loaded; skeletons without the bar are just skeletons.

```html
<div data-pg-loading-progress data-pg-loading-progress-state="loading"></div>

<section aria-busy="true" aria-label="Loading videos">
    <div data-pg-skeleton style="aspect-ratio: 16 / 9"></div>
    …
</section>
```

## Next

React has no "a page is loading" signal of its own — only `useTransition`'s
`isPending` and `<Suspense>`, both for one part of the tree. Next has
`useLinkStatus` and `<Link onNavigate>`, again for one link. Nothing tells
the whole app that a page change has begun or ended.

So: the bar starts on the click, as on any site, and is told the change is
over when the route has changed — the URL is the one sign Next gives.

```tsx
// app/layout.tsx
<body>
    <div data-pg-loading-progress data-pg-loading-progress-state="loading" />
    <LoadingProgress />
    {children}
</body>
```

```tsx
// LoadingProgress.tsx
"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { doneLoading, initLoadingProgress } from "@plusguard/loading-progress";

function RouteDone() {
    const pathname = usePathname();
    const search = useSearchParams();
    useEffect(() => doneLoading(), [pathname, search]);
    return null;
}

export function LoadingProgress() {
    useEffect(() => initLoadingProgress(), []);
    // useSearchParams in its own Suspense: the rest still prerenders.
    return (
        <Suspense fallback={null}>
            <RouteDone />
        </Suspense>
    );
}
```

Give the new route's `loading.tsx` or `<Suspense>` fallbacks
`aria-busy="true"`, as skeletons have, and the bar does not fill until the
streamed content has replaced them. A bare `data-pg-loading-progress` in JSX is written `"true"`, which
counts as the bar.

A new route opens at the top — Next's choice, not the bar's. For a change
that stays on the same page (a search, a filter, a page number), keep the
scroll position with `scroll={false}`; the bar runs either way:

```tsx
<Link href="?page=2" scroll={false}>Next page</Link>
router.replace(`?q=${q}`, { scroll: false });
```

Next's `<Form>` sends itself — it calls `preventDefault` and changes the
route — so it does not start the bar. If you want one, call
`startLoading()` in its `onSubmit` and its `done()` once the results are
in.

See [`examples/react/Example.tsx`](examples/react/Example.tsx).

## On a static site

Nothing to call besides `initLoadingProgress()`. A click starts the bar;
the browser leaves the page; the next page, written with
`data-pg-loading-progress-state="loading"` like every page, **carries on**
where the bar was, with the link's timing — the start is handed over in
`sessionStorage`. Without storage (some private modes) it starts over.

A link or a form opens a new page, which starts at the top — or at its
`#hash`: `<form action="#results">` comes back to the results. To stay put
without a new page, send the form from your script and use
`startLoading()`.

Back and Forward from the browser's page cache show the page as it was
left, bar and all: it is cleared on the way back.

See [`examples/static/index.html`](examples/static/index.html) — links
with each timing, a form, `off`, jobs of your own, and `aria-busy` cards
whose "data" takes as long as a box at the top left says: from 0s to 5s,
with the bar timed for each. The React example has the same box.

## Written by loading-progress

| Where | What                                                                                    |
| ----- | --------------------------------------------------------------------------------------- |
| Bar   | `data-pg-loading-progress-state`: none (idle), `"loading"`, `"done"` (filling, fading)  |
| Bar   | `aria-hidden="true"`                                                                    |
| Bar   | `--pg-loading-progress-from`: how far the creep had got when the page was ready         |
| Bar   | `--pg-loading-progress-elapsed`: on a static site, how long ago the page change began  |
| Bar   | The four timing variables, for the run under way                                        |

Style on the state: `[data-pg-loading-progress-state="loading"]`.

## CSS variables

Set anywhere above the bar — media queries welcome.

| Variable                        | Default                                   | What                                  |
| ------------------------------- | ----------------------------------------- | ------------------------------------- |
| `--pg-loading-progress-height`  | `2px`                                     | Its thickness                         |
| `--pg-loading-progress-color`   | `linear-gradient(90deg, #ff0033 80%, #ff2791)` | The fill: a colour or a gradient — YouTube's red, pink at the tip |
| `--pg-loading-progress-track`   | the text colour at 20%                    | The strip behind the fill — dark on a light page, light on a dark one |
| `--pg-loading-progress-shadow`  | `none`                                    | Around the bar                        |
| `--pg-loading-progress-z`       | `2100`                                    | Its stacking                          |
| `--pg-loading-progress-delay`   | `0ms`                                     | See [Timing](#timing)                 |
| `--pg-loading-progress-duration` | `2s`                                     |                                       |
| `--pg-loading-progress-easing`  | `cubic-bezier(0.1, 0.7, 0.3, 1)`          |                                       |
| `--pg-loading-progress-finish`  | `200ms`                                   |                                       |

With reduced motion asked for, there is no creep: the bar stands half full
while loading, and is full once ready.

## Screen readers

The bar is a picture of waiting, and is hidden from them. What they hear
is `aria-busy` on the parts still loading — the same signal the bar waits
for.
