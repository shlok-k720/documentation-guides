/*!
 * GuideShell — the shared shell for Category 1 documentation guides.
 *
 * One file, no dependencies, no build step. It renders and wires up every
 * repeated element of a guide page: the sidebar and table of contents,
 * search, progress, previous/next, reader settings (theme and text size),
 * print, code blocks with syntax highlighting and Copy buttons, and tabs.
 *
 * How a guide uses it (see public/api/README.md for the full example):
 *
 *   <script src="../api/guide-shell.js">
 *   <script>
 *     GuideShell.init({
 *       storagePrefix: "ftclib",
 *       title: "FTC Library Guide",
 *       brandMark: "FTC",
 *       brandTitle: "FTC Library Guide",
 *       brandSubtitle: "Java and Kotlin, published with JitPack",
 *       sections: [
 *         { id: "welcome", title: "Welcome", group: "Start here", summary: "..." },
 *         // ... one entry per <section class="doc-page">
 *       ]
 *     });
 *   (end of the second script element)
 *
 * If `sections` is omitted, they are read from the page itself: each
 * `.doc-page` section contributes its id, `data-title`, `data-group`
 * (default "Sections"), and `data-summary`.
 *
 * The shell markup (sidebar, settings dialog, mobile controls, top bar)
 * is created only where it is missing, so this file can also wire up an
 * existing guide that already has that markup in its HTML. It never
 * touches the guide's content sections, and it includes no CSS:
 * styling lives in the companion file guide-shell.css in the same
 * directory, which a guide links from <head>. See the README for what
 * still differs between guides (notably the Swift guide's
 * highlighter and stylesheet).
 *
 * This is a behaviour-preserving port of the inline scripts in the
 * Category 1 guides (C/C++, Documentation Creation, FTC Library Guide),
 * with two deliberate generalisations:
 *   1. Pages are looked up by section id, not by position, so the
 *      sections list and the DOM order do not have to agree.
 *   2. Every control is optional. A missing element is skipped instead
 *      of throwing, so a partial shell still works.
 *
 * Version: 1.0.0
 */
(function (global, factory) {
  var api = factory();
  // Browser first: this file is a browser shell, so when a `document`
  // exists, GuideShell always lands on the window, even in contexts
  // where a CommonJS `module` object is also visible (for example
  // jsdom's window.eval). The CommonJS export is only for Node tests.
  if (typeof module !== "undefined" && module.exports) {
    try { module.exports = api; } catch (e) { /* browser-only build */ }
  }
  if (global && global.document) {
    global.GuideShell = api;
  } else if (typeof window !== "undefined" && window.document) {
    window.GuideShell = api;
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function slugify(value) {
    return String(value || "guide")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guide";
  }

  function storageKey(prefix, name) {
    return prefix + "-" + name;
  }

  /* ------------------------------------------------------------------ */
  /* Syntax highlighting                                                 */
  /*                                                                     */
  /* Ported from the Category 1 guides. The default keyword/type lists  */
  /* are the C/C++ ones those guides ship. A guide in another language  */
  /* passes its own lists (see createHighlighter, and the Swift example */
  /* in the README), or a whole custom `highlight` function via        */
  /* init({ highlight: fn }).                                           */
  /* ------------------------------------------------------------------ */

  var DEFAULT_KEYWORDS = [
    "alignas", "alignof", "and", "asm", "auto", "bitand", "bitor", "bool",
    "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t",
    "class", "compl", "concept", "const", "consteval", "constexpr",
    "constinit", "const_cast", "continue", "co_await", "co_return",
    "co_yield", "decltype", "default", "delete", "do", "double",
    "dynamic_cast", "else", "enum", "explicit", "export", "extern",
    "false", "float", "for", "friend", "goto", "if", "inline", "int",
    "long", "mutable", "namespace", "new", "noexcept", "not", "nullptr",
    "operator", "or", "override", "private", "protected", "public",
    "register", "reinterpret_cast", "requires", "return", "short",
    "signed", "sizeof", "static", "static_assert", "static_cast",
    "struct", "switch", "template", "this", "thread_local", "throw",
    "true", "try", "typedef", "typeid", "typename", "union", "unsigned",
    "using", "virtual", "void", "volatile", "wchar_t", "while", "xor",
    "_Bool", "_Atomic", "_Generic", "_Noreturn", "_Static_assert"
  ];

  var DEFAULT_TYPES = [
    "size_t", "ptrdiff_t", "int8_t", "int16_t", "int32_t", "int64_t",
    "uint8_t", "uint16_t", "uint32_t", "uint64_t", "FILE", "std",
    "string", "string_view", "vector", "array", "map", "unordered_map",
    "set", "optional", "variant", "unique_ptr", "shared_ptr", "weak_ptr",
    "span", "thread", "mutex", "lock_guard", "unique_lock", "atomic",
    "future"
  ];

  // Classify one token. `lang` is the language name without the
  // "language-" prefix (for example "bash", "kotlin", "text").
  function classifyToken(token, lang, keywords, types) {
    var escaped = escapeHtml(token);
    if (/^\/\//.test(token) || /^\/\*/.test(token) ||
        (/^#/.test(token) && (lang === "bash" || lang === "powershell"))) {
      return '<span class="tok-comment">' + escaped + "</span>";
    }
    if (/^#/.test(token)) return '<span class="tok-preproc">' + escaped + "</span>";
    if (/^["']/.test(token)) return '<span class="tok-string">' + escaped + "</span>";
    if (/^\d/.test(token)) return '<span class="tok-number">' + escaped + "</span>";
    if (keywords.has(token)) return '<span class="tok-keyword">' + escaped + "</span>";
    if (types.has(token)) return '<span class="tok-type">' + escaped + "</span>";
    if (/^[+\-*\/%=&|!<>^~?:]+$/.test(token)) {
      return '<span class="tok-operator">' + escaped + "</span>";
    }
    return escaped;
  }

  // Build a highlighter: highlight(rawSource, lang) -> HTML string.
  // `options.keywords` / `options.types` replace the C/C++ defaults.
  function createHighlighter(options) {
    options = options || {};
    var keywords = new Set(options.keywords || DEFAULT_KEYWORDS);
    var types = new Set(options.types || DEFAULT_TYPES);

    function classify(token, lang) {
      return classifyToken(token, lang, keywords, types);
    }

    return function highlight(raw, lang) {
      lang = String(lang || "text");

      if (lang === "text" || lang === "makefile" || lang === "cmake") {
        var generic = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\$\([^\)]+\)|\b(?:if|else|endif|set|project|add_library|add_executable|target_link_libraries|target_include_directories|target_compile_options)\b)/g;
        return raw.replace(generic, function (token) {
          return classify(token, lang);
        });
      }

      if (lang === "bash" || lang === "powershell") {
        var shell = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\$[A-Za-z_][A-Za-z0-9_]*|\b(?:sudo|apt|install|cmake|gcc|g\+\+|clang|clang\+\+|cc|c\+\+|cl|gdb|lldb|run|break|print|continue|set|if|else|fi)\b)/g;
        return raw.replace(shell, function (token) {
          return classify(token, lang);
        });
      }

      var tokenPattern = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[ \t]*[A-Za-z_][^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfF]*\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[+\-*\/%=&|!<>^~?:]+)/g;
      return raw.replace(tokenPattern, function (token) {
        return classify(token, lang);
      });
    };
  }

  var defaultHighlight = createHighlighter();

  function highlightCode(raw, lang, options) {
    if (options && typeof options.highlight === "function") {
      return options.highlight(raw, lang);
    }
    if (options && (options.keywords || options.types)) {
      return createHighlighter(options)(raw, lang);
    }
    return defaultHighlight(raw, lang);
  }

  /* ------------------------------------------------------------------ */
  /* Sections: from config, or read off the page                         */
  /* ------------------------------------------------------------------ */

  function normalizeSections(rawSections, doc) {
    var pages = Array.prototype.slice.call(
      doc.querySelectorAll(".doc-page")
    );

    var list;
    if (Array.isArray(rawSections) && rawSections.length) {
      list = rawSections.map(function (section) {
        return {
          id: String(section.id || ""),
          title: String(section.title || section.id || ""),
          group: String(section.group || "Sections"),
          summary: String(section.summary || "")
        };
      });
    } else {
      list = pages.map(function (page) {
        var heading = page.querySelector("h1, h2");
        return {
          id: page.id,
          title: page.getAttribute("data-title") ||
            (heading ? heading.textContent.trim() : page.id),
          group: page.getAttribute("data-group") || "Sections",
          summary: page.getAttribute("data-summary") || ""
        };
      });
    }

    // Keep only sections that actually have a page on this document.
    var pageIds = {};
    pages.forEach(function (page) { pageIds[page.id] = true; });
    var kept = list.filter(function (section) {
      if (!section.id || !pageIds[section.id]) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "GuideShell: no .doc-page with id " +
              JSON.stringify(section.id) + "; skipping it."
          );
        }
        return false;
      }
      return true;
    });
    return kept;
  }

  // Group sections keeping first-seen group order: [[group, [sections]]].
  function groupSections(sections) {
    var order = [];
    var byGroup = {};
    sections.forEach(function (section) {
      if (!byGroup[section.group]) {
        byGroup[section.group] = [];
        order.push(section.group);
      }
      byGroup[section.group].push(section);
    });
    return order.map(function (group) {
      return { group: group, sections: byGroup[group] };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering: sidebar, top bar, mobile controls, settings dialog      */
  /*                                                                     */
  /* Each renderer creates its markup only if the element is missing.   */
  /* Existing markup is reused untouched, so guides that already have   */
  /* a sidebar keep working without any HTML change.                   */
  /* ------------------------------------------------------------------ */

  function renderSidebar(doc, config) {
    if (doc.getElementById("sidebar")) return doc.getElementById("sidebar");

    var aside = doc.createElement("aside");
    aside.className = "sidebar";
    aside.id = "sidebar";
    aside.setAttribute("aria-label", "Documentation navigation");
    aside.innerHTML =
      '<div class="sidebar-head"><div class="brand">' +
      '<div class="brand-mark"></div><div>' +
      '<div class="brand-title"></div>' +
      '<div class="brand-sub"></div>' +
      "</div></div></div>" +
      '<div class="search-wrap">' +
      '<label class="sr-only" for="navSearch">Search documentation</label>' +
      '<input id="navSearch" class="search" type="search" ' +
      'placeholder="Search topics…  /" autocomplete="off">' +
      "</div>" +
      '<nav class="nav-scroll"><ul class="nav-tree" id="navTree"></ul></nav>' +
      '<div class="sidebar-footer">' +
      '<div class="progress-row">' +
      '<span id="progressLabel"></span><span id="progressPercent"></span>' +
      "</div>" +
      '<div class="progress-track"><div class="progress-bar" id="progressBar"></div></div>' +
      '<div class="footer-buttons">' +
      '<button class="side-action" id="prevBtn" type="button" aria-label="Previous page">← Previous</button>' +
      '<button class="side-action" id="nextBtn" type="button" aria-label="Next page">Next →</button>' +
      '<button class="side-action" id="settingsBtn" type="button" aria-label="Open settings">⚙</button>' +
      "</div></div>";

    aside.querySelector(".brand-mark").textContent = config.brandMark;
    aside.querySelector(".brand-title").textContent = config.brandTitle;
    aside.querySelector(".brand-sub").textContent = config.brandSubtitle;

    var main = doc.getElementById("main");
    var shell = doc.querySelector(".app-shell");
    if (shell) {
      shell.insertBefore(aside, shell.firstChild);
    } else if (main && main.parentNode) {
      main.parentNode.insertBefore(aside, main);
    } else {
      doc.body.insertBefore(aside, doc.body.firstChild);
    }
    return aside;
  }

  function renderSidebarTab(doc) {
    if (doc.getElementById("sidebarTab")) {
      return doc.getElementById("sidebarTab");
    }
    var tab = doc.createElement("button");
    tab.className = "sidebar-tab";
    tab.id = "sidebarTab";
    tab.type = "button";
    tab.setAttribute("aria-expanded", "true");
    tab.setAttribute("aria-controls", "sidebar");
    tab.textContent = "Contents";
    var sidebar = doc.getElementById("sidebar");
    if (sidebar && sidebar.parentNode) {
      sidebar.parentNode.insertBefore(tab, sidebar.nextSibling);
    } else {
      doc.body.insertBefore(tab, doc.body.firstChild);
    }
    return tab;
  }

  function renderTopbar(doc) {
    // The crumb + search/print actions live in <main>. If a guide
    // already has them, leave them alone.
    if (doc.getElementById("crumbGroup")) return null;
    var main = doc.getElementById("main");
    if (!main) return null;

    var header = doc.createElement("header");
    header.className = "topbar";
    header.innerHTML =
      '<div class="topbar-inner">' +
      '<div class="crumb"><span id="crumbGroup"></span> / ' +
      "<strong id=\"crumbTitle\"></strong></div>" +
      '<div class="top-actions">' +
      '<button class="icon-btn" id="focusSearchBtn" type="button" title="Search">⌕</button>' +
      '<button class="icon-btn" id="printBtn" type="button" title="Print or save as PDF">⎙</button>' +
      "</div></div>";
    main.insertBefore(header, main.firstChild);
    return header;
  }

  function renderMobileControls(doc) {
    if (doc.getElementById("mobilePrev")) return;
    var bar = doc.createElement("div");
    bar.className = "mobile-bottom";
    bar.setAttribute("aria-label", "Page controls");
    bar.innerHTML =
      '<button id="mobilePrev" type="button">← Previous</button>' +
      '<button id="mobileNext" type="button">Next →</button>' +
      '<button id="mobileSettings" type="button" aria-label="Open settings">⚙</button>';
    var main = doc.getElementById("main");
    if (main && main.parentNode) {
      main.parentNode.insertBefore(bar, main.nextSibling);
    } else {
      doc.body.appendChild(bar);
    }
  }

  function renderSearchResults(doc) {
    if (doc.getElementById("searchResults")) {
      return doc.getElementById("searchResults");
    }
    var box = doc.createElement("div");
    box.className = "search-results";
    box.id = "searchResults";
    box.setAttribute("role", "listbox");
    box.setAttribute("aria-label", "Search results");
    doc.body.appendChild(box);
    return box;
  }

  function renderSettingsDialog(doc) {
    if (doc.getElementById("settingsDialog")) {
      return doc.getElementById("settingsDialog");
    }
    var dialog = doc.createElement("dialog");
    dialog.id = "settingsDialog";
    dialog.innerHTML =
      '<div class="modal-head"><h2>Reader settings</h2>' +
      '<button class="icon-btn" id="closeSettings" type="button" aria-label="Close settings">×</button></div>' +
      '<div class="modal-body">' +
      '<div class="setting-row"><label>Theme</label>' +
      '<div class="segmented" aria-label="Theme">' +
      '<button id="lightTheme" type="button" data-theme-choice="light">☀ Light</button>' +
      '<button id="darkTheme" type="button" data-theme-choice="dark">☾ Dark</button>' +
      "</div></div>" +
      '<div class="setting-row"><label for="textSize">Text size</label>' +
      '<div class="range-row"><span>A</span>' +
      '<input id="textSize" type="range" min="85" max="130" step="5" value="100">' +
      '<span style="font-size:1.25em">A</span></div>' +
      '<p id="textSizeLabel" style="margin:.5rem 0 0;color:var(--muted);font-size:.85rem;">100%</p>' +
      "</div></div>" +
      '<div class="modal-foot"><button class="primary-btn" id="doneSettings" type="button">Done</button></div>';
    doc.body.appendChild(dialog);
    return dialog;
  }

  // Create every missing shell element. Returns the elements init()
  // needs, whether they were just created or already on the page.
  function renderShell(doc, config) {
    renderSidebar(doc, config);
    renderSidebarTab(doc);
    renderTopbar(doc);
    renderMobileControls(doc);
    renderSearchResults(doc);
    renderSettingsDialog(doc);
    return {
      sidebar: doc.getElementById("sidebar"),
      sidebarTab: doc.getElementById("sidebarTab"),
      navSearch: doc.getElementById("navSearch"),
      navTree: doc.getElementById("navTree"),
      searchResults: doc.getElementById("searchResults"),
      crumbGroup: doc.getElementById("crumbGroup"),
      crumbTitle: doc.getElementById("crumbTitle"),
      progressLabel: doc.getElementById("progressLabel"),
      progressPercent: doc.getElementById("progressPercent"),
      progressBar: doc.getElementById("progressBar"),
      settingsDialog: doc.getElementById("settingsDialog")
    };
  }

  // Build (or rebuild) the table of contents from `sections`.
  // Returns the nav-link buttons, in sections order.
  function renderNav(doc, sections, onNavigate) {
    var navTree = doc.getElementById("navTree");
    if (!navTree) return [];
    navTree.innerHTML = "";
    var links = [];
    groupSections(sections).forEach(function (group) {
      var groupItem = doc.createElement("li");
      groupItem.className = "nav-group";
      var label = doc.createElement("span");
      label.textContent = group.group;
      groupItem.appendChild(label);
      var list = doc.createElement("ul");
      group.sections.forEach(function (section) {
        var item = doc.createElement("li");
        var button = doc.createElement("button");
        button.className = "nav-link";
        button.type = "button";
        button.setAttribute("data-target", section.id);
        button.textContent = section.title;
        button.addEventListener("click", function () {
          onNavigate(section.id);
        });
        item.appendChild(button);
        list.appendChild(item);
        links.push(button);
      });
      groupItem.appendChild(list);
      navTree.appendChild(groupItem);
    });
    return links;
  }

  /* ------------------------------------------------------------------ */
  /* Code blocks and tabs                                                */
  /* ------------------------------------------------------------------ */

  function languageOf(code) {
    var found = null;
    Array.prototype.forEach.call(code.classList, function (name) {
      if (name.indexOf("language-") === 0) found = name.slice("language-".length);
    });
    return found || "text";
  }

  // Highlight every <pre><code>, and make sure every .code-shell has
  // a Copy button that copies the un-highlighted source. Idempotent:
  // calling it twice does not add a second button or re-highlight
  // already-highlighted code (dataset.raw is the source of truth).
  function enhanceCodeBlocks(doc, options) {
    options = options || {};
    doc.querySelectorAll("pre code").forEach(function (code) {
      var lang = languageOf(code);
      var raw = code.getAttribute("data-raw") || code.textContent;
      code.setAttribute("data-raw", raw);
      code.innerHTML = highlightCode(raw, lang, options);
    });

    doc.querySelectorAll(".code-shell").forEach(function (shell) {
      var code = shell.querySelector("code");
      var toolbar = shell.querySelector(".code-toolbar");
      if (!toolbar) {
        toolbar = doc.createElement("div");
        toolbar.className = "code-toolbar";
        var label = doc.createElement("span");
        label.className = "code-lang";
        label.textContent = code
          ? languageOf(code).toUpperCase()
          : "TEXT";
        toolbar.appendChild(label);
        shell.insertBefore(toolbar, shell.firstChild);
      }
      if (!toolbar.querySelector(".copy-btn")) {
        var button = doc.createElement("button");
        button.className = "copy-btn";
        button.type = "button";
        button.setAttribute("aria-label", "Copy code");
        button.textContent = "Copy";
        toolbar.appendChild(button);
      }
    });

    doc.querySelectorAll(".copy-btn").forEach(function (button) {
      if (button.getAttribute("data-guide-shell-bound")) return;
      button.setAttribute("data-guide-shell-bound", "true");
      button.addEventListener("click", function () {
        var shell = button.closest(".code-shell");
        var code = shell ? shell.querySelector("code") : null;
        if (!code) return;
        var text = code.getAttribute("data-raw") || code.textContent;
        var done = function (ok) {
          var previous = button.textContent;
          button.textContent = ok ? "Copied" : "Select manually";
          setTimeout(function () {
            button.textContent = previous;
          }, 1200);
        };
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { done(true); },
            function () { done(false); }
          );
        } else {
          done(false);
        }
      });
    });
  }

  function enhanceTabs(doc) {
    doc.querySelectorAll("[data-tabs]").forEach(function (tabset) {
      if (tabset.getAttribute("data-guide-shell-bound")) return;
      tabset.setAttribute("data-guide-shell-bound", "true");
      var buttons = Array.prototype.slice.call(
        tabset.querySelectorAll('[role="tab"]')
      );
      var panels = Array.prototype.slice.call(
        tabset.querySelectorAll(".tab-panel")
      );
      buttons.forEach(function (button, index) {
        button.addEventListener("click", function () {
          buttons.forEach(function (b, i) {
            b.setAttribute("aria-selected", String(i === index));
          });
          panels.forEach(function (panel, i) {
            panel.hidden = i !== index;
          });
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                              */
  /* ------------------------------------------------------------------ */

  function pageText(page) {
    // innerText is layout-aware in browsers; fall back to textContent
    // (for example in a test DOM) so search still works.
    return (page.innerText || page.textContent || "").toLowerCase();
  }

  function scoreMatches(query, sections, pagesById) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return sections
      .map(function (section, index) {
        var page = pagesById[section.id];
        var text = page ? pageText(page) : "";
        var score = 0;
        if (section.title.toLowerCase().indexOf(q) !== -1) score += 8;
        if (section.group.toLowerCase().indexOf(q) !== -1) score += 3;
        if (section.summary.toLowerCase().indexOf(q) !== -1) score += 4;
        if (text.indexOf(q) !== -1) score += 1;
        return {
          id: section.id,
          title: section.title,
          group: section.group,
          summary: section.summary,
          index: index,
          score: score
        };
      })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) {
        return b.score - a.score || a.index - b.index;
      })
      .slice(0, 10);
  }

  /* ------------------------------------------------------------------ */
  /* init: render the shell, then wire everything up                      */
  /* ------------------------------------------------------------------ */

  function init(config) {
    config = config || {};
    var doc = config.document || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    // `win` is the browsing context. It is only ever `window` in a
    // browser; accepting it via config keeps init() testable with a
    // stub DOM, where storage/scroll/hash simply become no-ops.
    var win = config.window ||
      (typeof window !== "undefined" ? window : null);
    var memoryStore = {};

    var prefix = config.storagePrefix || slugify(config.title);
    var brandTitle = config.brandTitle || config.title || doc.title || "Guide";
    var shellConfig = {
      brandMark: config.brandMark || brandTitle.slice(0, 2).toUpperCase(),
      brandTitle: brandTitle,
      brandSubtitle: config.brandSubtitle || ""
    };

    var sections = normalizeSections(config.sections, doc);
    if (!sections.length) return null;
    var pagesById = {};
    doc.querySelectorAll(".doc-page").forEach(function (page) {
      pagesById[page.id] = page;
    });

    var el = renderShell(doc, shellConfig);
    var navLinks = renderNav(doc, sections, function (id) {
      showPage(indexOfId(id));
    });

    var sidebar = el.sidebar;
    var sidebarTab = el.sidebarTab;
    var navSearch = el.navSearch;
    var searchResults = el.searchResults;
    var crumbGroup = el.crumbGroup;
    var crumbTitle = el.crumbTitle;
    var progressLabel = el.progressLabel;
    var progressPercent = el.progressPercent;
    var progressBar = el.progressBar;
    var settingsDialog = el.settingsDialog;

    var prevButtons = [doc.getElementById("prevBtn"), doc.getElementById("mobilePrev")]
      .filter(Boolean);
    var nextButtons = [doc.getElementById("nextBtn"), doc.getElementById("mobileNext")]
      .filter(Boolean);
    var settingsButtons = [doc.getElementById("settingsBtn"), doc.getElementById("mobileSettings")]
      .filter(Boolean);
    var themeButtons = Array.prototype.slice.call(
      doc.querySelectorAll("[data-theme-choice]")
    );
    var textSize = doc.getElementById("textSize");
    var textSizeLabel = doc.getElementById("textSizeLabel");

    var currentIndex = 0;
    var searchSelection = -1;

    var storage = {
      get: function (key) {
        try {
          return win && win.localStorage
            ? win.localStorage.getItem(key)
            : (key in memoryStore ? memoryStore[key] : null);
        } catch (e) { return null; }
      },
      set: function (key, value) {
        try {
          if (win && win.localStorage) win.localStorage.setItem(key, value);
          else memoryStore[key] = value;
        } catch (e) { /* session-only */ }
      }
    };

    function indexOfId(id) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === id) return i;
      }
      return -1;
    }

    function isMobile() {
      return !!(win && win.matchMedia &&
        win.matchMedia("(max-width: 900px)").matches);
    }

    function updateHash(id) {
      if (!win) return;
      try {
        win.history.replaceState(null, "", "#" + id);
      } catch (e) {
        try { win.location.hash = id; } catch (ignored) { /* hash is a nicety */ }
      }
    }

    function showPage(index, pushHash) {
      if (pushHash === undefined) pushHash = true;
      currentIndex = Math.max(0, Math.min(index, sections.length - 1));
      var current = sections[currentIndex];

      Object.keys(pagesById).forEach(function (id) {
        pagesById[id].classList.toggle("active", id === current.id);
      });
      navLinks.forEach(function (link, i) {
        link.classList.toggle("active", i === currentIndex);
      });

      if (crumbGroup) crumbGroup.textContent = current.group;
      if (crumbTitle) crumbTitle.textContent = current.title;
      doc.title = current.title + " — " + brandTitle;

      prevButtons.forEach(function (btn) { btn.disabled = currentIndex === 0; });
      nextButtons.forEach(function (btn) {
        btn.disabled = currentIndex === sections.length - 1;
      });

      var percent = Math.round(((currentIndex + 1) / sections.length) * 100);
      if (progressLabel) {
        progressLabel.textContent = (currentIndex + 1) + " of " + sections.length;
      }
      if (progressPercent) progressPercent.textContent = percent + "%";
      if (progressBar) progressBar.style.width = percent + "%";

      if (navLinks[currentIndex] && navLinks[currentIndex].scrollIntoView) {
        navLinks[currentIndex].scrollIntoView({ block: "nearest" });
      }
      if (win && win.scrollTo) win.scrollTo({ top: 0, behavior: "instant" });

      if (pushHash) updateHash(current.id);
      storage.set(storageKey(prefix, "current-page"), current.id);

      if (sidebar && isMobile()) {
        sidebar.classList.remove("open");
        if (sidebarTab) sidebarTab.setAttribute("aria-expanded", "false");
      }
    }

    function go(delta) {
      showPage(currentIndex + delta);
    }

    function setTheme(theme) {
      doc.documentElement.setAttribute("data-theme", theme);
      // Keep both dataset and attribute in sync for older markup.
      doc.documentElement.dataset.theme = theme;
      themeButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-theme-choice") === theme);
      });
      storage.set(storageKey(prefix, "theme"), theme);
    }

    function setTextSize(value) {
      var numeric = Number(value);
      doc.documentElement.style.setProperty("--font-scale", numeric / 100);
      if (textSize) textSize.value = String(numeric);
      if (textSizeLabel) textSizeLabel.textContent = numeric + "%";
      storage.set(storageKey(prefix, "text-size"), String(numeric));
    }

    prevButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { go(-1); });
    });
    nextButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { go(1); });
    });

    if (sidebarTab && sidebar) {
      sidebarTab.addEventListener("click", function () {
        if (isMobile()) {
          var open = sidebar.classList.toggle("open");
          sidebarTab.setAttribute("aria-expanded", String(open));
        } else {
          var collapsed = sidebar.classList.toggle("collapsed");
          sidebarTab.setAttribute("aria-expanded", String(!collapsed));
          storage.set(storageKey(prefix, "sidebar-collapsed"), String(collapsed));
        }
      });
    }

    var focusSearchBtn = doc.getElementById("focusSearchBtn");
    if (focusSearchBtn && navSearch && sidebar) {
      focusSearchBtn.addEventListener("click", function () {
        if (isMobile()) {
          sidebar.classList.add("open");
        } else {
          sidebar.classList.remove("collapsed");
        }
        if (sidebarTab) sidebarTab.setAttribute("aria-expanded", "true");
        navSearch.focus();
      });
    }

    var printBtn = doc.getElementById("printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () { if (win) win.print(); });
    }

    settingsButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (settingsDialog && settingsDialog.showModal) settingsDialog.showModal();
      });
    });
    [doc.getElementById("closeSettings"), doc.getElementById("doneSettings")]
      .filter(Boolean)
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (settingsDialog) settingsDialog.close();
        });
      });
    themeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.getAttribute("data-theme-choice"));
      });
    });
    if (textSize) {
      textSize.addEventListener("input", function () {
        setTextSize(textSize.value);
      });
    }
    if (settingsDialog) {
      settingsDialog.addEventListener("click", function (event) {
        var rect = settingsDialog.getBoundingClientRect();
        var inside = event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) settingsDialog.close();
      });
    }

    enhanceCodeBlocks(doc, config);
    enhanceTabs(doc);

    function renderSearchResults(matches) {
      if (!searchResults || !navSearch) return;
      searchResults.innerHTML = "";
      searchSelection = -1;

      if (!navSearch.value.trim()) {
        searchResults.classList.remove("open");
        return;
      }
      if (!matches.length) {
        searchResults.innerHTML =
          '<div style="padding:14px;color:var(--muted)">No matching sections.</div>';
        searchResults.classList.add("open");
        return;
      }
      matches.forEach(function (match) {
        var button = doc.createElement("button");
        button.type = "button";
        button.className = "search-result";
        button.setAttribute("data-index", String(match.index));
        button.innerHTML =
          "<strong>" + escapeHtml(match.title) + "</strong><span>" +
          escapeHtml(match.group) + " · " + escapeHtml(match.summary) +
          "</span>";
        button.addEventListener("click", function () {
          showPage(match.index);
          navSearch.value = "";
          searchResults.classList.remove("open");
        });
        searchResults.appendChild(button);
      });
      searchResults.classList.add("open");
    }

    if (navSearch) {
      navSearch.addEventListener("input", function () {
        var q = navSearch.value.trim().toLowerCase();
        renderSearchResults(scoreMatches(q, sections, pagesById));
        doc.querySelectorAll(".nav-group").forEach(function (group) {
          var anyVisible = false;
          group.querySelectorAll(".nav-link").forEach(function (link) {
            var visible = !q || link.textContent.toLowerCase().indexOf(q) !== -1;
            link.hidden = !visible;
            if (visible) anyVisible = true;
          });
          group.hidden = q ? !anyVisible : false;
        });
      });

      navSearch.addEventListener("keydown", function (event) {
        var results = searchResults
          ? Array.prototype.slice.call(searchResults.querySelectorAll(".search-result"))
          : [];
        if (event.key === "ArrowDown" && results.length) {
          event.preventDefault();
          searchSelection = Math.min(searchSelection + 1, results.length - 1);
        } else if (event.key === "ArrowUp" && results.length) {
          event.preventDefault();
          searchSelection = Math.max(searchSelection - 1, 0);
        } else if (event.key === "Enter" && searchSelection >= 0) {
          event.preventDefault();
          results[searchSelection].click();
          return;
        } else if (event.key === "Escape") {
          if (searchResults) searchResults.classList.remove("open");
          navSearch.blur();
          return;
        }
        results.forEach(function (r, i) {
          r.classList.toggle("active", i === searchSelection);
        });
      });
    }

    doc.addEventListener("click", function (event) {
      if (searchResults && navSearch &&
          !searchResults.contains(event.target) && event.target !== navSearch) {
        searchResults.classList.remove("open");
      }
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "/" && !/input|textarea|select/i.test(doc.activeElement.tagName)) {
        event.preventDefault();
        if (focusSearchBtn) focusSearchBtn.click();
      }
      if (event.altKey && event.key === "ArrowLeft") go(-1);
      if (event.altKey && event.key === "ArrowRight") go(1);
    });

    if (win) {
      win.addEventListener("hashchange", function () {
        var index = indexOfId(win.location.hash.slice(1));
        if (index >= 0) showPage(index, false);
      });
    }

    setTheme(storage.get(storageKey(prefix, "theme")) || "light");
    setTextSize(storage.get(storageKey(prefix, "text-size")) || "100");

    if (sidebar && !isMobile() &&
        storage.get(storageKey(prefix, "sidebar-collapsed")) === "true") {
      sidebar.classList.add("collapsed");
      if (sidebarTab) sidebarTab.setAttribute("aria-expanded", "false");
    }

    var currentHash = win ? win.location.hash : "";
    var initialId = currentHash.slice(1) ||
      storage.get(storageKey(prefix, "current-page")) ||
      sections[0].id;
    var initialIndex = indexOfId(initialId);
    showPage(initialIndex < 0 ? 0 : initialIndex, !currentHash);

    return {
      sections: sections,
      showPage: showPage,
      go: go,
      setTheme: setTheme,
      setTextSize: setTextSize,
      elements: el
    };
  }

  return {
    VERSION: "1.0.0",
    init: init,
    renderShell: renderShell,
    renderNav: renderNav,
    enhanceCodeBlocks: enhanceCodeBlocks,
    enhanceTabs: enhanceTabs,
    escapeHtml: escapeHtml,
    highlightCode: highlightCode,
    createHighlighter: createHighlighter,
    scoreMatches: scoreMatches,
    groupSections: groupSections,
    normalizeSections: normalizeSections,
    storageKey: storageKey,
    _internals: {
      escapeHtml: escapeHtml,
      highlightCode: highlightCode,
      createHighlighter: createHighlighter,
      scoreMatches: scoreMatches,
      groupSections: groupSections,
      normalizeSections: normalizeSections,
      storageKey: storageKey,
      slugify: slugify
    }
  };
});
