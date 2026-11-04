# Guide shell API

`guide-shell.js` is the one shared JavaScript file for Category 1
documentation guides. It renders and wires up every element those guides
repeat: the sidebar and table of contents, search, progress, previous/next
buttons, reader settings, print, code blocks, and tabs.

It has no dependencies and no build step. It is loaded with a plain
`<script>` tag, so it works on GitHub Pages and from a local checkout
exactly like the inline scripts it replaces.

## Where it lives, and why

The file is at `public/api/guide-shell.js`, not at the repo root. GitHub
Pages serves `public/`, so a guide at `public/guides/*.html` loads it as
`../api/guide-shell.js`. A copy at the repo root would never be deployed.

The name is deliberately not a route the Express server already uses
(`GET /api/guides`, `POST /api/request-guide`, and so on). Locally,
Express serves it as a static file because no `/api/*.js` route matches
it first.

## New guide: minimal page

A new guide needs the guide CSS (still inline in each guide file for
now, see "What this file does not do" below), one `<main>` with one
`<section class="doc-page">` per page, and two script tags at the end
of `<body>`:

```html
<script src="../api/guide-shell.js"></script>
<script>
  GuideShell.init({
    storagePrefix: "myguide",
    title: "My Guide",
    brandMark: "MG",
    brandTitle: "My Guide",
    brandSubtitle: "What it is for",
    sections: [
      { id: "welcome", title: "Welcome", group: "Start here", summary: "..." },
      { id: "setup", title: "Setup", group: "Start here", summary: "..." }
    ]
  });
</script>
```

`GuideShell.init()` creates the sidebar, sidebar tab, top bar, mobile
controls, search-results box, and settings dialog if they are missing,
builds the table of contents from `sections`, and wires up everything
below. If `sections` is omitted, they are read from the page: each
`.doc-page` gives its `id`, `data-title`, `data-group` (default
`"Sections"`), and `data-summary`. Sections whose id has no matching
`.doc-page` are skipped with a console warning.

A page section looks like this:

```html
<section class="doc-page" id="welcome"
         data-title="Welcome"
         data-summary="What this guide covers.">
  <div class="page-inner">
    <h1>My Guide</h1>
    ...
  </div>
</section>
```

## What init() wires up

| Element | Behaviour |
|---|---|
| Table of contents (`#navTree`) | Grouped by `group`, in first-seen order. Clicking a link shows that page. The active link follows the current page. |
| Search (`#navSearch`) | Scores title (8), summary (4), group (3), and page text (1); shows the top 10 matches. Typing also filters the table of contents. Arrow keys move through results, Enter opens one, Escape closes. `/` focuses search from anywhere except a form field. |
| Progress | `N of M`, percent, and bar width, updated on every page change. |
| Previous / Next | Sidebar buttons plus the mobile bottom bar. Alt+Left / Alt+Right do the same. Disabled at the first / last page. |
| Settings (`#settingsDialog`) | Light/dark theme and text size (85–130%), saved in `localStorage` under `<prefix>-theme` and `<prefix>-text-size`. Clicking outside the dialog closes it. |
| Sidebar tab | Collapses the sidebar on desktop (remembered as `<prefix>-sidebar-collapsed`) and opens it as an overlay on mobile. |
| Print (`#printBtn`) | `window.print()`. |
| Page state | The current page id is kept in the URL hash and in `localStorage` (`<prefix>-current-page`). Loading with a hash, or returning later, resumes on that page. |
| Code blocks | Every `<pre><code class="language-*">` is syntax-highlighted; the original source is kept in `data-raw` so Copy copies plain text, not highlighted HTML. Every `.code-shell` gets a Copy button if it does not already have one. |
| Tabs | Any `[data-tabs]` group switches its `.tab-panel` children when a `[role="tab"]` button is clicked. |

`init()` returns a controller (`{ sections, showPage, go, setTheme,
setTextSize, elements }`), or `null` when the page has no `.doc-page`
sections. Missing individual controls are skipped, not fatal: a page
with no settings dialog, for example, still gets navigation and search.

## Config

| Option | Required? | Meaning |
|---|---|---|
| `storagePrefix` | Recommended | Prefix for all `localStorage` keys. Defaults to a slug of `title`. Existing guides keep their old prefixes (`ccpp`, `swift6`, `docguide`, `ftclib`) when they migrate, so readers keep their saved theme and page. |
| `title` | Recommended | Suffix for `document.title` on every page (`"<page title> — <title>"`), and the fallback brand title. |
| `brandMark`, `brandTitle`, `brandSubtitle` | No | Sidebar brand. Defaults to the first two letters of the title, the title, and an empty subtitle. |
| `sections` | No | Explicit section list (see above). Omit to derive from `.doc-page` elements. |
| `keywords`, `types` | No | Word lists for the built-in highlighter, replacing the C/C++ defaults. See "Highlighting" below. |
| `highlight` | No | A custom `function (raw, lang) -> html` that replaces highlighting entirely. |

## Highlighting

The built-in highlighter is the one the Category 1 guides already ship:
comments, preprocessor lines, strings, numbers, keywords, types, and
operators, with special handling for `text`/`makefile`/`cmake` and for
`bash`/`powershell`. Its default keyword and type lists are C/C++.

A guide in another language passes its own lists, exactly as the Swift
guide's inline highlighter does today:

```js
GuideShell.init({
  storagePrefix: "swift6",
  title: "Swift 6 + SwiftUI",
  keywords: ["actor", "class", "func", "guard", /* ... */],
  types: ["Int", "String", "Bool", /* ... */]
});
```

`GuideShell.createHighlighter({ keywords, types })` and
`GuideShell.highlightCode(raw, lang, options)` are also exported for
reuse and testing. Highlighting is deliberately a simple tokenizer,
not a full parser: it can misclassify an unusual token, and that is
fine for guide examples.

## Migrating an existing guide

1. Delete the guide's inline `<script>` block and its hardcoded
   `<ul class="nav-tree">…</ul>` contents (leave the empty `<ul>`; the
   API rebuilds it). Keep the rest of the sidebar markup, or delete it
   too and let the API render it: either works, because `init()`
   creates only what is missing.
2. Add the two script tags above, with the guide's existing
   `storagePrefix` and its existing `sections` array copied verbatim
   (it is the only place the `group` for each page lives; `.doc-page`
   elements do not carry `data-group` today).
3. Keep the inline `<style>` untouched. Nothing else changes.

Migrate one guide at a time and check it in a browser before moving
to the next. Do not migrate the Category 2 teaching companions with
this file: they use a different template (MathJax, practice blocks)
that this shell does not render.

## What this file does not do

- **CSS.** The guide stylesheet (about 15 KB, identical in the C/C++,
  Documentation Creation, and FTC guides) is still inline in each
  guide. Extracting it into a shared stylesheet is the natural next
  step, but it is a separate change: it touches every guide file at
  once, and the Swift guide's stylesheet differs.
- **Category 2 guides.** See above.
- **The index page.** `public/app.js` (the guide listing) is untouched.

## Testing

`node --check public/api/guide-shell.js` must pass. The pure helpers
(`escapeHtml`, `highlightCode`, `scoreMatches`, `groupSections`,
`normalizeSections`, `storageKey`) are exported through
`GuideShell._internals` and through `module.exports` under Node, so
they can be unit-tested without a browser. Browser behaviour
(navigation, search UI, settings persistence, copy) still needs a
manual check in a browser against a real guide page; that check has
not been done for this first version.
