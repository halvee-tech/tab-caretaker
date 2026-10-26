# Tab Caretaker（标签管家）

Tab Caretaker is a local-first browser extension for people who work with many tabs. It is designed to automatically organize tabs, prevent accidental duplicates, and safely archive inactive pages before closing them.

Tab Caretaker 是一个本地优先的浏览器标签管理扩展：自动整理标签页、防止无意重复，并在关闭长期未查看的页面前安全归档。

## Product principles

- Automate without taking control away from the user.
- Prevent accidental duplicates while allowing intentional copies.
- Archive before closing and make automated actions reversible.
- Keep tab metadata on the user's device by default.

## Core features

- Manual or optional automatic grouping by domain.
- Duplicate-tab guard with intentional-copy exceptions and a dedicated “copy and keep” context-menu action.
- One-click cleanup for duplicate tabs that are already open, with batch undo.
- Search and switch across every browser window.
- Optional Chrome side panel listing every open tab, with distinct grouped and ungrouped sections.
- Inactive-tab tracking, local archiving, restoration, and reversible automated actions.
- Automatic archiving uses a 3-day inactivity threshold by default and remains configurable.
- Protected tabs, domain allowlists, and a local action history.

All browser-changing automation is disabled by default. Manual actions are available immediately, and automated archiving always writes a recoverable local record before closing a tab.

## Current capabilities

- Versioned local storage with migration from the original settings format and schema v1.
- Activity tracking for tab creation, activation, updates, removal, and window focus.
- Conservative protection rules for active, pinned, audible, manually protected, allowlisted, and restricted tabs.
- URL comparison that normalizes casing and trailing slashes while removing only configured tracking parameters.
- Intent-aware duplicate guarding for newly created external or linked tabs: address-bar navigation is preserved only when it matches the page active immediately before the new tab, with one-time exemptions for deliberate copies.
- Local archives with restore/reopen support and a bounded operation history with undo.
- Manual and optional automatic domain grouping for every web tab, including single-tab domains, with compact one-word labels such as `weixin` or `cooco`.
- A popup-first workflow for cross-window search, a compact status summary, one-click deduplication, automation switches, and undo. The automatic-grouping switch immediately groups all current web tabs when enabled and removes all groups when disabled.
- A lightweight secondary page for archive thresholds, advanced rules, and local archives.
- A live side-panel view with cross-window search, collapsible Chrome tab groups, a separate ungrouped list, and click-to-focus navigation.

Enable **标签侧边栏** in the popup to open Chrome's native side panel. This setting is off by default; disabling it removes the side-panel entry. The extension requests the `sidePanel` permission for this feature. Tab creation, closure, movement, updates, and group changes refresh the open panel automatically.

## Development

Requirements:

- Node.js 22+
- pnpm 10+

```bash
pnpm install
pnpm dev
```

Load the generated `.output/chrome-mv3-dev` directory from `chrome://extensions` with Developer mode enabled.

After changing permissions or rebuilding, click **Reload** on the extension card before testing.

Useful commands:

```bash
pnpm check
pnpm test
pnpm build
pnpm zip
```

## Technology

- Manifest V3
- WXT
- React
- TypeScript

## Current safety boundary

The extension does not request access to page contents or download history. It therefore cannot reliably detect unsaved form edits or map an in-progress download to its originating tab. Automatic archiving remains off by default; use manual protection or a domain allowlist for pages where that state must be preserved.

## License

[MIT](LICENSE)
