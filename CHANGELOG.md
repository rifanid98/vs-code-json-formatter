# Changelog

All notable changes to this project will be documented in this file.

---

## [0.5.0] — 2026-07-22

### Added

- **CodeMirror-Powered Input Editor** — The plain input textarea is now a real
  CodeMirror 6 editor, giving the input pane genuine editor behavior instead
  of bare-textarea limitations.
- **Tab / Shift+Tab Indent** — Tab indents the current line or selected block
  by 2 spaces instead of moving focus away; Shift+Tab dedents. Indentation is
  now JSON-aware (auto-indent on new lines, bracket matching).
- **Multi-Cursor: Add Cursor Above/Below** — `Cmd+Option+Up` / `Cmd+Option+Down`
  (`Ctrl+Alt+Up/Down` on Windows/Linux) adds an additional cursor on the line
  above or below, matching common code-editor multi-cursor behavior.
- **Select Next Occurrence** — `Cmd+G` / `Ctrl+G` selects the word under the
  cursor, then adds the next matching occurrence to the selection each time
  it's pressed again — useful for editing repeated keys/values across the
  document at once.

### Changed

- Webview script is now bundled via esbuild (`media/webview.js`) instead of
  being inlined directly in the panel HTML, to support the CodeMirror
  dependency.

---

## [0.1.3] — 2026-06-05

### Changed

- **Unescape — Smarter Level-by-Level Algorithm** — Each click of ⟲ Unescape
  now walks the parsed JSON tree and replaces any string value that is a valid
  JSON object or array with its parsed counterpart, leaving the rest of the
  document untouched. One escape layer is peeled per click (outer → inner).

### Fixed

- Unescape no longer corrupts valid JSON when the input is an object or array
  containing escaped string values. The previous fallback blindly stripped all
  `\"` sequences, which produced invalid JSON in most real-world cases.

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
