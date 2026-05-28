# JSON Formatter

A VSCode side panel JSON formatter. Paste raw JSON into the input, transform it in place, and explore the structure with an interactive collapsible tree.

---

## Features

### Accordion Layout
The panel is split into two collapsible sections — **Input** and **Tree** — separated by a draggable sash. Click a section header to collapse or expand it. Drag the sash between them to resize the split to your preference.

### Input Panel
Paste any raw or escaped JSON into the textarea. All transform operations work directly on this text. Word wrap is off by default; enable it with the **⇌ Wrap** button.

### Interactive Tree View
The parsed JSON is rendered as a collapsible tree below the input. All nodes start collapsed to the top level — click any `▶` arrow to expand a node, `▼` to collapse it.

### Toolbar Buttons

| Button | Action |
|---|---|
| **▶ Expand** | Pretty-print input (2-space indent) / Expand all tree nodes |
| **◀ Collapse** | Minify input to a single line / Collapse tree to top level |
| **⟲ Unescape** `Lx` | Remove one layer of backslash escaping per click (outer → inner). The `Lx` badge shows the current escape depth |
| **⇌ Wrap** | Toggle word wrap for both the input textarea and tree view (off by default) |
| **⎘ Copy** | Copy raw input text to clipboard |
| **✕ Clear** | Clear input and tree |
| **⌕ Find** | Open the Find & Replace bar |

### Find & Replace

Open the Find & Replace bar via the **⌕ Find** button or keyboard shortcut. It provides:
- **Live search** with match count (`n / total`)
- **↑ ↓** navigation between matches
- **Replace** — replace the current match
- **All** — replace all matches at once
- `Escape` closes the bar and returns focus to the input

### Unescape by Level

Each click of **⟲ Unescape** removes exactly one outer layer of escaping:

- **Strategy 1** — If the entire input is a JSON-encoded string, `JSON.parse()` unwraps it cleanly
- **Strategy 2** — Otherwise, removes one `\` before each `\"` per click

The `Lx` badge (e.g. `L2`) next to the button shows how many escape levels are currently detected. It disappears when no escaping remains.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+=` | Expand |
| `Ctrl+Shift+-` | Collapse |
| `Ctrl+Shift+Up` | Unescape |
| `Ctrl+F` | Open / close Find & Replace bar |
| `Ctrl+H` | Open / close Find & Replace bar |
| `Enter` (in Find box) | Next match |
| `Shift+Enter` (in Find box) | Previous match |
| `Escape` (in Find bar) | Close Find & Replace bar |

> Mac: replace `Ctrl` with `Cmd`.

---

## Usage

1. Click the **JSON Formatter icon** in the Activity Bar (left sidebar)
2. Paste JSON into the **Input** textarea
3. The tree view renders automatically as you type
4. Use toolbar buttons or keyboard shortcuts to transform

### Example — Unescape by Level

**Level 2 escaped input:**
```
[{\\\"usersUpdated\\\":2}]
```

After **first Unescape** (L2 → L1):
```
[{\"usersUpdated\":2}]
```

After **second Unescape** (L1 → clean):
```json
[{"usersUpdated":2}]
```

### Example — Expand

Input:
```json
{"name":"John","age":30,"tags":["go","ts"]}
```

After **Expand**:
```json
{
  "name": "John",
  "age": 30,
  "tags": [
    "go",
    "ts"
  ]
}
```

---

## Build VSIX

Requirements: [Node.js](https://nodejs.org) installed.

```bash
# 1. Install dependencies
npm install

# 2. Install the vsce packaging tool (once)
npm install -g @vscode/vsce

# 3. Package
npm run package
```

This produces `json-formatter-x.x.x.vsix` in the project root.

---

## Installation

Install from the VSIX file:

1. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
2. Select `json-formatter-0.1.0.vsix`
3. Reload VSCode when prompted

Or via terminal:
```bash
code --install-extension json-formatter-0.1.0.vsix
```
