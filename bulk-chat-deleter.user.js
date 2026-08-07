// ==UserScript==
// @name         ChatGPT/Claude/Gemini Bulk Chat Deleter
// @namespace    https://github.com/BulkChatDeleter
// @version      1.1.0
// @description  Batch delete ChatGPT and Claude conversations, plus Gemini chats and Notebooks from the Gemini page.
// @author       KiraKiraAyu
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async function BulkChatDeleter() {
  "use strict";

  const PLATFORM = (() => {
    const h = location.hostname;
    if (h === "chatgpt.com") return "chatgpt";
    if (h === "gemini.google.com") return "gemini";
    if (h === "claude.ai") return "claude";
    return null;
  })();

  if (!PLATFORM) {
    console.log("[BCD] Not a supported platform, exiting");
    return;
  }

  console.log(`[BCD] Running on platform: ${PLATFORM}`);

  const CONFIGS = {
    chatgpt: {
      sidebar: [
        'nav[aria-label="Chat history"]',
        'nav[class*="sidebar"]',
        "nav",
      ],
      item: [
        'li.list-none:has(a[href^="/c/"])',
        'li[data-sidebar-item="true"]',
        'nav li:has(a[href*="/c/"])',
        "nav li.list-none",
      ],
      itemLink: ['a[href^="/c/"]', 'a[href*="/c/"]'],
      menuTrigger: [
        "button[data-conversation-options-trigger]",
        'button[data-testid$="-options"]',
        'button[aria-label*="options" i]',
        "button.__menu-item-trailing-btn",
        "button:has(svg)",
      ],
      deleteMenuItem: {
        selectors: [
          '[role="menuitem"]',
          'button[role="menuitem"]',
          '[data-testid*="delete"]',
        ],
        textMatch: /delete/i,
      },
      confirmButton: {
        selectors: [
          'button[data-testid="delete-conversation-confirm-button"]',
          '[role="dialog"] button',
        ],
        textMatch: /delete/i,
      },
      toolbarAnchor: [
        'nav[aria-label="Chat history"] > div:first-child',
        "nav > div:first-child",
      ],
      stepDelay: 150,
      deletionDelay: 300,
      waitGoneTimeout: 15000, // ChatGPT takes ~6.5s to remove item from DOM
    },

    gemini: {
      sidebar: [
        "bard-sidenav", // actual 288px sidebar panel
        '[data-test-id="bard-sidenav-container"]', // fallback (full-page wrapper)
      ],
      item: [
        'gem-nav-list-item[data-test-id="conversation"]',
        '[data-test-id="conversation"]',
        "mat-list-item",
      ],
      itemLink: ["a[mat-list-item]", 'a[href^="/app/"]', "a"],
      menuTrigger: [
        '[data-test-id="actions-menu-button"] button',
        'gem-icon-button[data-test-id="actions-menu-button"]',
        'button[aria-label*="more" i]',
        "button[matIconButton]",
        "button:has(mat-icon)",
      ],
      deleteMenuItem: {
        selectors: [
          '[role="menuitem"]',
          "button[mat-menu-item]",
          'button[role="menuitem"]',
        ],
        textMatch: /delete/i,
      },
      confirmButton: {
        selectors: [
          "mat-dialog-container button",
          '[role="dialog"] button',
          ".cdk-overlay-container button",
          '[role="alertdialog"] button',
        ],
        textMatch: /delete/i,
      },
      // Insert before the chats expandable section inside infinite-scroller (display:block, 276px)
      // Avoids inserting into mat-nav-list which breaks Angular Material layout
      toolbarInsertBefore: '[data-test-id="chats-expandable-section"]',
      toolbarAnchor: [],
      stepDelay: 400,
      deletionDelay: 800,
    },

    claude: {
      sidebar: [
        'nav:has(a[href^="/chat/"])',
        'aside:has(a[href^="/chat/"])',
        "nav",
        "aside",
      ],
      // Claude: conversation items are li > div.relative.group > a[href^="/chat/"]
      // We target the li wrapper for checkbox placement
      item: ['li:has(a[href^="/chat/"])', 'li:has(a[href*="/chat/"])'],
      itemLink: ['a[href^="/chat/"]', 'a[href*="/chat/"]'],
      menuTrigger: [
        'button[aria-label*="conversation" i]',
        'button[aria-label*="menu" i]',
        'button[aria-label*="options" i]',
        "div.relative.group button",
        "button:has(svg)",
      ],
      deleteMenuItem: {
        selectors: [
          '[role="menuitem"]',
          'button[role="menuitem"]',
          '[data-value*="delete" i]',
        ],
        textMatch: /delete/i,
      },
      confirmButton: {
        selectors: [
          '[role="dialog"] button',
          '[role="alertdialog"] button',
          '[class*="modal" i] button',
        ],
        textMatch: /delete/i,
      },
      toolbarAnchor: [
        "nav > div:first-child",
        "nav > ul",
        "aside > div:first-child",
      ],
      stepDelay: 350,
      deletionDelay: 1500,
    },
  };

  const cfg = CONFIGS[PLATFORM];

  // Gemini exposes notebooks in two places: the sidebar and the dedicated
  // "All notebooks" card view. Keep this target separate from conversations
  // so the default batch mode cannot select the wrong resource type.
  const GEMINI_NOTEBOOK_CONFIG = {
    label: "Notebook",
    pluralLabel: "Notebooks",
    item: [
      'gem-nav-list-item[data-test-id="project-item-button-gem"]',
      ".notebook-card-view .project-card",
    ],
    itemLink: ['a[href^="/notebook/"]'],
    menuTrigger: [
      'gem-icon-button[data-test-id="actions-menu-icon"] button',
      'button[aria-label="Open notebook actions menu"]',
    ],
    deleteMenuItem: {
      selectors: [
        '[role="menuitem"]',
        "button[mat-menu-item]",
        'button[role="menuitem"]',
        "gem-menu-item",
        '[data-test-id*="delete" i]',
      ],
      textMatch: /delete/i,
    },
    confirmButton: {
      selectors: [
        '[role="dialog"] button',
        '[role="alertdialog"] button',
        "mat-dialog-container button",
        ".cdk-overlay-container button",
        '[data-test-id*="delete" i]',
      ],
      textMatch: /delete/i,
    },
    stepDelay: 400,
    deletionDelay: 800,
    getItems: () => {
      if (location.pathname.startsWith("/notebooks/view")) {
        return Array.from(
          document.querySelectorAll(".notebook-card-view .project-card"),
        );
      }
      return sidebarElement
        ? Array.from(
            sidebarElement.querySelectorAll(
              'gem-nav-list-item[data-test-id="project-item-button-gem"]',
            ),
          )
        : [];
    },
  };

  let activeTarget = "conversations";

  function getActiveConfig() {
    return PLATFORM === "gemini" && activeTarget === "notebooks"
      ? GEMINI_NOTEBOOK_CONFIG
      : cfg;
  }

  function getTargetItems(itemConfig = getActiveConfig()) {
    if (typeof itemConfig.getItems === "function") return itemConfig.getItems();
    return sidebarElement
      ? Array.from(sidebarElement.querySelectorAll(itemConfig.item.join(", ")))
      : [];
  }

  function getItemIdentity(itemEl, itemConfig) {
    const link = trySelector(itemConfig.itemLink, itemEl);
    if (link?.getAttribute("href"))
      return { type: "href", value: link.getAttribute("href") };

    const title = itemEl
      .querySelector('.title, .title-text, [data-test-id="card-title"]')
      ?.textContent.trim();
    const all = getTargetItems(itemConfig);
    const occurrence =
      all
        .slice(0, all.indexOf(itemEl) + 1)
        .filter(
          (el) =>
            el
              .querySelector('.title, .title-text, [data-test-id="card-title"]')
              ?.textContent.trim() === title,
        ).length - 1;
    return { type: "card", title: title || "", occurrence };
  }

  function findItemByIdentity(identity, itemConfig) {
    const items = getTargetItems(itemConfig);
    if (identity.type === "href") {
      return items.find((item) =>
        item.querySelector(`a[href="${CSS.escape(identity.value)}"]`),
      );
    }
    return (
      items.filter(
        (item) =>
          item
            .querySelector('.title, .title-text, [data-test-id="card-title"]')
            ?.textContent.trim() === identity.title,
      )[identity.occurrence] || null
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────────

  let batchModeActive = false;
  let abortRequested = false;
  let sidebarObserver = null;
  let sidebarElement = null;

  // ──────────────────────────────────────────────────────────────────
  // UTILITIES
  // ──────────────────────────────────────────────────────────────────

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function trySelector(list, root = document) {
    for (const sel of list) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (e) {
        // Invalid selector, continue
      }
    }
    return null;
  }

  function findByText(config, root = document) {
    const candidates = root.querySelectorAll(config.selectors.join(", "));
    for (const el of candidates) {
      if (config.textMatch.test(el.textContent.trim())) {
        return el;
      }
    }
    return null;
  }

  function waitForElement(selector, root = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = trySelector([selector], root);
      if (el) return resolve(el);

      const timer = setTimeout(() => {
        obs.disconnect();
        reject(new Error(`Timeout waiting for: ${selector}`));
      }, timeout);

      const obs = new MutationObserver(() => {
        const found = trySelector([selector], root);
        if (found) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(found);
        }
      });

      obs.observe(root, { childList: true, subtree: true });
    });
  }

  function waitForGone(element, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!document.contains(element)) return resolve();

      const timer = setTimeout(() => {
        obs.disconnect();
        reject(new Error("Element did not disappear"));
      }, timeout);

      const obs = new MutationObserver(() => {
        if (!document.contains(element)) {
          clearTimeout(timer);
          obs.disconnect();
          resolve();
        }
      });

      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  async function waitForMenuItemWithRetry(menuItemConfig, timeout = 4000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const el = findByText(menuItemConfig, document.body);
      if (el) return el;
      await delay(100);
    }
    throw new Error("Delete menu item not found");
  }

  async function waitForConfirmButton(confirmConfig, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const el = findByText(confirmConfig, document.body);
      // Wait for button to exist AND not be disabled — some sites (e.g. Claude)
      // briefly disable the confirm button after the dialog opens to prevent mis-clicks.
      if (el && !el.disabled && !el.hasAttribute("disabled")) return el;
      await delay(100);
    }
    throw new Error("Confirm button not found or stayed disabled");
  }

  async function waitForMenuButton(itemEl, itemConfig, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const btn = trySelector(itemConfig.menuTrigger, itemEl);
      // Return as soon as the button exists in the DOM.
      // JS .click() works even when the button is CSS-hidden (e.g. Tailwind group-hover on Claude).
      if (btn) return btn;
      await delay(100);
    }
    throw new Error("Menu button not found");
  }

  // ──────────────────────────────────────────────────────────────────
  // UI INJECTION & MANAGEMENT
  // ──────────────────────────────────────────────────────────────────

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #bcd-toolbar {
        box-sizing: border-box;
        width: 100%;
        padding: 6px 12px;
      }

      #bcd-toggle-btn {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 6px 12px;
        background: transparent;
        color: inherit;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        text-align: left;
        gap: 6px;
        opacity: 0.7;
        transition: opacity 0.15s, background 0.15s;
        margin-bottom: 6px
      }

      #bcd-toggle-btn:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.12);
      }

      body.bcd-active #bcd-toggle-btn {
        opacity: 1;
        color: #0070f3;
      }

      .bcd-controls {
        display: none;
        flex-direction: column;
        gap: 4px;
      }

      body.bcd-active .bcd-controls {
        display: flex;
      }

      .bcd-btn-row {
        display: flex;
        gap: 4px;
      }

      .bcd-target-row {
        display: flex;
        gap: 0;
        margin-bottom: 2px;
      }

      .bcd-target-btn {
        flex: 1;
        padding: 4px 8px;
        background: rgba(128, 128, 128, 0.1);
        border: 1px solid rgba(128, 128, 128, 0.25);
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        color: inherit;
      }

      .bcd-target-btn:first-child { border-radius: 4px 0 0 4px; }
      .bcd-target-btn:last-child { border-radius: 0 4px 4px 0; }

      .bcd-target-btn.active {
        background: rgba(0, 112, 243, 0.16);
        border-color: rgba(0, 112, 243, 0.55);
        color: #0070f3;
      }

      .bcd-btn {
        flex: 1;
        padding: 4px 8px;
        background: rgba(128, 128, 128, 0.1);
        border: 1px solid rgba(128, 128, 128, 0.25);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        color: inherit;
        transition: background 0.15s;
      }

      .bcd-btn:hover {
        background: rgba(128, 128, 128, 0.2);
      }

      #bcd-delete-btn {
        background: rgba(220, 38, 38, 0.15);
        border-color: rgba(220, 38, 38, 0.4);
        color: #dc2626;
        margin-top: 2px;
      }

      #bcd-delete-btn:hover:not(:disabled) {
        background: rgba(220, 38, 38, 0.25);
      }

      #bcd-delete-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      #bcd-progress {
        display: none;
        padding: 4px 8px 8px;
        font-size: 12px;
        font-family: inherit;
        color: inherit;
        opacity: 0.8;
      }

      #bcd-progress.visible {
        display: block;
      }

      #bcd-progress-bar {
        width: 100%;
        height: 3px;
        background: rgba(128, 128, 128, 0.2);
        border-radius: 2px;
        margin-top: 4px;
        overflow: hidden;
      }

      #bcd-progress-fill {
        height: 100%;
        background: #0070f3;
        transition: width 0.3s;
        width: 0%;
      }

      #bcd-cancel-btn {
        margin-top: 6px;
      }

      .bcd-checkbox {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-70%);
        z-index: 9999;
        width: 20px;
        height: 20px;
        cursor: pointer;
        accent-color: #0070f3;
      }

      .bcd-notebook-card-checkbox {
        right: 2rem;
        top: 0.8rem;
        transform: none;
      }

      body:not(.bcd-active) .bcd-checkbox {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "style") Object.assign(el.style, v);
      else if (k === "textContent") el.textContent = v;
      else el.setAttribute(k, v);
    });
    children.forEach((c) =>
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c),
    );
    return el;
  }

  async function injectToolbar() {
    if (document.getElementById("bcd-toolbar")) return;

    // Build toolbar without innerHTML to satisfy Trusted Types CSP (e.g. Gemini)
    const toolbar = createEl("div", { id: "bcd-toolbar" });

    const toggleBtn = createEl("button", { id: "bcd-toggle-btn" }, [
      createEl("span", { style: { fontSize: "15px" } }, ["🗑"]),
      createEl("span", {}, [" Batch Delete"]),
    ]);
    toolbar.appendChild(toggleBtn);

    const controls = createEl("div", { class: "bcd-controls" });

    if (PLATFORM === "gemini") {
      const targetRow = createEl("div", {
        class: "bcd-target-row",
        role: "group",
        "aria-label": "Batch delete target",
      });
      targetRow.appendChild(
        createEl("button", {
          class: "bcd-target-btn active",
          id: "bcd-target-conversations",
          textContent: "Chats",
          type: "button",
        }),
      );
      targetRow.appendChild(
        createEl("button", {
          class: "bcd-target-btn",
          id: "bcd-target-notebooks",
          textContent: "Notebooks",
          type: "button",
        }),
      );
      controls.appendChild(targetRow);
    }

    const btnRow = createEl("div", { class: "bcd-btn-row" });
    btnRow.appendChild(
      createEl("button", {
        class: "bcd-btn",
        id: "bcd-select-all",
        textContent: "Select All",
      }),
    );
    btnRow.appendChild(
      createEl("button", {
        class: "bcd-btn",
        id: "bcd-deselect-all",
        textContent: "Clear",
      }),
    );
    controls.appendChild(btnRow);
    controls.appendChild(
      createEl("button", {
        class: "bcd-btn",
        id: "bcd-delete-btn",
        disabled: "",
        textContent: "Delete (0)",
      }),
    );
    toolbar.appendChild(controls);

    const progress = createEl("div", { id: "bcd-progress" });
    progress.appendChild(
      createEl("div", { id: "bcd-progress-text", textContent: "Deleting..." }),
    );
    const bar = createEl("div", { id: "bcd-progress-bar" });
    bar.appendChild(createEl("div", { id: "bcd-progress-fill" }));
    progress.appendChild(bar);
    progress.appendChild(
      createEl("button", {
        class: "bcd-btn",
        id: "bcd-cancel-btn",
        textContent: "Cancel",
      }),
    );
    toolbar.appendChild(progress);

    // Find insertion point — wait for anchor when platform uses lazy-rendered content
    let insertionParent = null;
    let insertionBefore = null;

    if (cfg.toolbarInsertBefore) {
      try {
        const anchor = await waitForElement(
          cfg.toolbarInsertBefore,
          sidebarElement,
          10000,
        );
        if (anchor?.parentElement) {
          insertionParent = anchor.parentElement;
          insertionBefore = anchor;
        }
      } catch (e) {
        console.warn(
          "[BCD] toolbarInsertBefore anchor not found, using fallback",
        );
      }
    }

    if (!insertionParent) {
      try {
        const firstItem = await waitForElement(
          cfg.item[0],
          sidebarElement,
          8000,
        );
        if (firstItem?.parentElement) {
          insertionParent = firstItem.parentElement;
          insertionBefore = firstItem;
        }
      } catch (e) {
        // ignore
      }
    }

    if (insertionParent) {
      insertionParent.insertBefore(toolbar, insertionBefore);
    } else {
      sidebarElement.prepend(toolbar);
    }

    document
      .getElementById("bcd-toggle-btn")
      .addEventListener("click", toggleBatchMode);
    document
      .getElementById("bcd-target-conversations")
      ?.addEventListener("click", () => setActiveTarget("conversations"));
    document
      .getElementById("bcd-target-notebooks")
      ?.addEventListener("click", () => setActiveTarget("notebooks"));
    document
      .getElementById("bcd-select-all")
      .addEventListener("click", selectAll);
    document
      .getElementById("bcd-deselect-all")
      .addEventListener("click", deselectAll);
    document
      .getElementById("bcd-delete-btn")
      .addEventListener("click", deleteSelected);
    document
      .getElementById("bcd-cancel-btn")
      .addEventListener("click", abortDeletion);

    document.addEventListener("change", (e) => {
      if (e.target.matches(".bcd-checkbox")) updateDeleteButton();
    });
  }

  function toggleBatchMode() {
    batchModeActive = !batchModeActive;
    document.body.classList.toggle("bcd-active", batchModeActive);

    const toggleBtn = document.getElementById("bcd-toggle-btn");
    // Update just the text span, not the icon span
    const textSpan = toggleBtn.querySelector("span:last-child");
    if (textSpan) {
      textSpan.textContent = batchModeActive
        ? " Exit Batch Mode"
        : " Batch Delete";
    }
    const iconSpan = toggleBtn.querySelector("span:first-child");
    if (iconSpan) {
      iconSpan.textContent = batchModeActive ? "✖" : "🗑";
    }

    if (batchModeActive) {
      addCheckboxesToItems();
    } else {
      removeAllCheckboxes();
    }
  }

  function setActiveTarget(target) {
    if (
      PLATFORM !== "gemini" ||
      !["conversations", "notebooks"].includes(target) ||
      target === activeTarget
    )
      return;
    activeTarget = target;
    removeAllCheckboxes();
    document
      .getElementById("bcd-target-conversations")
      ?.classList.toggle("active", target === "conversations");
    document
      .getElementById("bcd-target-notebooks")
      ?.classList.toggle("active", target === "notebooks");
    if (batchModeActive) addCheckboxesToItems();
  }

  function addCheckboxesToItems() {
    const itemConfig = getActiveConfig();
    const items = getTargetItems(itemConfig);
    items.forEach((item, idx) => {
      // Skip if checkbox already exists
      if (item.querySelector(".bcd-checkbox")) return;

      // Set relative positioning if needed
      const computed = getComputedStyle(item);
      if (computed.position === "static") {
        item.style.position = "relative";
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "bcd-checkbox";
      checkbox.dataset.bcdId = idx;
      if (item.classList.contains("project-card")) {
        checkbox.classList.add("bcd-notebook-card-checkbox");

        // Notebook cards navigate on pointer/click events. Keep selection
        // interactions inside the checkbox from reaching that card handler.
        [
          "pointerdown",
          "pointerup",
          "mousedown",
          "mouseup",
          "touchstart",
          "click",
          "keydown",
        ].forEach((type) =>
          checkbox.addEventListener(type, (event) => event.stopPropagation()),
        );
      }

      item.prepend(checkbox);
    });

    updateDeleteButton();
  }

  function removeAllCheckboxes() {
    document.querySelectorAll(".bcd-checkbox").forEach((cb) => cb.remove());
    updateDeleteButton();
  }

  function selectAll() {
    getTargetItems(getActiveConfig())
      .flatMap((item) => Array.from(item.querySelectorAll(".bcd-checkbox")))
      .forEach((cb) => {
        cb.checked = true;
      });
    updateDeleteButton();
  }

  function deselectAll() {
    getTargetItems(getActiveConfig())
      .flatMap((item) => Array.from(item.querySelectorAll(".bcd-checkbox")))
      .forEach((cb) => {
        cb.checked = false;
      });
    updateDeleteButton();
  }

  function getSelectedItems() {
    const itemConfig = getActiveConfig();
    const checkboxes = getTargetItems(itemConfig).flatMap((item) =>
      Array.from(item.querySelectorAll(".bcd-checkbox:checked")),
    );
    return checkboxes
      .map((cb) => ({
        checkbox: cb,
        itemEl: cb.closest(itemConfig.item.join(", ")),
        identity: getItemIdentity(
          cb.closest(itemConfig.item.join(", ")),
          itemConfig,
        ),
      }))
      .filter((item) => item.itemEl);
  }

  function updateDeleteButton() {
    const selected = getSelectedItems();
    const deleteBtn = document.getElementById("bcd-delete-btn");
    const label = getActiveConfig().pluralLabel || "Chats";
    deleteBtn.textContent = `Delete ${label} (${selected.length})`;
    deleteBtn.disabled = selected.length === 0;
  }

  function showProgress(current, total) {
    const progress = document.getElementById("bcd-progress");
    const text = document.getElementById("bcd-progress-text");
    const fill = document.getElementById("bcd-progress-fill");

    progress.classList.add("visible");
    text.textContent = `Deleting ${current} / ${total}...`;
    fill.style.width = `${(current / total) * 100}%`;

    // Hide batch controls during deletion
    document.querySelector(".bcd-controls").style.display = "none";
  }

  function hideProgress() {
    const progress = document.getElementById("bcd-progress");
    progress.classList.remove("visible");

    // Show batch controls again
    if (batchModeActive) {
      document.querySelector(".bcd-controls").style.display = "flex";
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // DELETION AUTOMATION
  // ──────────────────────────────────────────────────────────────────

  async function deleteOne(itemEl, itemConfig) {
    // 1. Scroll into view
    itemEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await delay(itemConfig.stepDelay);

    // 2. Trigger hover — fire on item and all ancestors up to sidebar
    // so CSS group-hover and Angular CDK overlay triggers fire correctly
    const hoverTargets = [itemEl];
    let parent = itemEl.parentElement;
    while (parent && parent !== sidebarElement) {
      hoverTargets.unshift(parent);
      parent = parent.parentElement;
    }
    for (const target of hoverTargets) {
      target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    }
    await delay(itemConfig.stepDelay);

    // 3. Find and click menu trigger, waiting for it to become visible
    const menuBtn = await waitForMenuButton(itemEl, itemConfig);
    menuBtn.focus();
    await delay(50);
    menuBtn.click();
    await delay(itemConfig.stepDelay);

    // 4. Wait for and click delete menu item
    const deleteItem = await waitForMenuItemWithRetry(
      itemConfig.deleteMenuItem,
    );
    deleteItem.click();
    await delay(itemConfig.stepDelay);

    // 5. Wait for and click confirm button
    const confirmBtn = await waitForConfirmButton(itemConfig.confirmButton);
    confirmBtn.click();
    // Brief pause to let the dialog close before the next item's menu opens
    await delay(itemConfig.deletionDelay);
  }

  async function deleteSelected() {
    const itemConfig = getActiveConfig();
    abortRequested = false;

    // Collect stable hrefs upfront — DOM nodes will be re-rendered by some
    // platforms (e.g. ChatGPT) after each deletion, but hrefs stay valid.
    const initialItems = getSelectedItems();
    const total = initialItems.length;
    if (total === 0) return;

    const label = itemConfig.pluralLabel || "conversations";
    if (
      !confirm(
        `Are you sure you want to delete ${total} ${label.toLowerCase()}?`,
      )
    )
      return;

    const targets = initialItems.map(({ identity }) => identity);
    if (
      itemConfig === GEMINI_NOTEBOOK_CONFIG &&
      location.pathname.startsWith("/notebooks/view")
    ) {
      targets.reverse();
    }

    let succeeded = 0;
    const failed = [];
    showProgress(0, total);

    for (let i = 0; i < targets.length; i++) {
      if (abortRequested) {
        console.log("[BCD] Aborted");
        break;
      }

      showProgress(i + 1, total);
      const identity = targets[i];

      // Find item by href — survives sidebar re-renders
      const itemEl = findItemByIdentity(identity, itemConfig);
      if (!itemEl) {
        // Already gone (deleted in a previous batch or by server)
        succeeded++;
        continue;
      }
      try {
        await deleteOne(itemEl, itemConfig);
        succeeded++;
      } catch (err) {
        console.warn("[BCD] Failed:", err.message);
        failed.push(identity.type === "href" ? identity.value : identity.title);
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            bubbles: true,
          }),
        );
        await delay(itemConfig.stepDelay * 2);
      }
    }

    hideProgress();
    const msg =
      failed.length > 0
        ? `Done. Deleted ${succeeded}, failed ${failed.length}.`
        : `Successfully deleted ${succeeded} ${label.toLowerCase()}.`;
    alert(`[Bulk Chat Deleter] ${msg}`);

    if (batchModeActive) {
      removeAllCheckboxes();
      await delay(500);
      addCheckboxesToItems();
    }
  }

  function abortDeletion() {
    abortRequested = true;
  }

  // ──────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────────────────────────────

  async function waitForSidebar() {
    console.log("[BCD] Waiting for sidebar...");
    for (const selector of cfg.sidebar) {
      try {
        const el = await waitForElement(selector, document, 10000);
        if (el) {
          console.log(`[BCD] Found sidebar with selector: ${selector}`);
          return el;
        }
      } catch (e) {
        // Try next selector
      }
    }
    throw new Error("Could not find sidebar");
  }

  function setupSidebarObserver() {
    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }

    let debounceTimer;
    sidebarObserver = new MutationObserver(() => {
      if (!batchModeActive) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        addCheckboxesToItems();
      }, 50);
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async function init() {
    try {
      injectStyles();
      sidebarElement = await waitForSidebar();
      injectToolbar();
      setupSidebarObserver();
      console.log("[BCD] Initialization complete");
    } catch (err) {
      console.error("[BCD] Initialization failed:", err);
    }
  }

  await init();
})();
