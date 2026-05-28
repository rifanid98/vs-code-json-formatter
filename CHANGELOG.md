# Changelog

All notable changes to this project will be documented in this file.

---

## [0.2.0] — 2026-05-28

### Added

- **VS Code-Style Accordion Layout** — Input and Tree sections are now collapsible with animated chevrons matching the native VS Code sidebar feel. A draggable sash between sections allows free height resizing.
- **Unescape by Level** — The ⟲ Unescape button now removes one outer escape layer per click (outer → inner) instead of stripping all at once. Supports both `JSON.parse()` unwrapping for fully-encoded strings and single-layer `\"` → `"` replacement.
- **`Lx` Escape Depth Badge** — A dynamic badge next to the Unescape button (e.g. `L2`) shows the current escape depth, auto-updating as you type.
- **Find & Replace Bar** — New ⌕ Find button (or `Ctrl+F` / `Ctrl+H`) opens an inline bar with live match count, ↑↓ navigation, single Replace, and Replace All.
- **Word Wrap Toggle** — New ⇌ Wrap button toggles word wrap for both the textarea and tree view (off by default, both scroll horizontally).
- **Keyboard Shortcuts** — `Ctrl+F` / `Ctrl+H` to open/close Find bar; `Enter` / `Shift+Enter` for next/previous match; `Escape` to close.

### Changed

- Search icon replaced from colored emoji (🔍) to plain monochrome symbol (⌕) to match toolbar button style.
- Toolbar now shows active button state (highlighted background) for toggleable buttons.
- Input textarea defaults to `wrap="off"` with horizontal scroll.

---

## [0.1.0] — Initial Release

- Side panel JSON formatter with Expand, Collapse, Unescape, Copy, and Clear toolbar actions.
- Interactive collapsible tree view for parsed JSON.
- Keyboard shortcuts: `Ctrl+Shift+=` (Expand), `Ctrl+Shift+-` (Collapse), `Ctrl+Shift+Up` (Unescape).
