# JSON Formatter

A VSCode side panel JSON formatter. Paste raw, escaped, or even unquoted log-style JSON into the input, transform it in place, and explore the structure with an interactive collapsible tree.

---

## Features

### Accordion Layout
The panel is split into two collapsible sections — **Input** and **Tree** — separated by a draggable sash. Click a section header to collapse or expand it. Drag the sash between them to resize the split to your preference.

### Input Panel
A full CodeMirror 6 code editor (not a plain textarea) for pasting and editing JSON. All transform operations work directly on this text.

- **Syntax highlighting** — keys, strings, numbers/booleans, and `null` are colored to match the Tree view below, so both panels read as one consistent view of the data.
- **Code folding** — multi-line `{...}` / `[...]` blocks get a clickable fold arrow (▾ / ▸) in the gutter, the same collapse/expand affordance as the Tree view, directly in the raw text.
- **Multi-cursor editing** — `Cmd/Ctrl+Alt+Up` / `Down` adds a cursor on the line above/below; `Cmd/Ctrl+G` selects the word under the cursor and adds the next matching occurrence each time it's pressed again.
- **Tab / Shift+Tab** indents/dedents the current line or selection by 2 spaces, JSON-aware.
- Word wrap is off by default; enable it with the **⇌ Wrap** button.

### Interactive Tree View
The parsed JSON is rendered as a collapsible tree below the input. All nodes start collapsed to the top level — click any `▶` arrow to expand a node, `▼` to collapse it.

### Toolbar Buttons

| Button | Action |
|---|---|
| **▶ Expand** | Pretty-print input (2-space indent) / Expand all tree nodes |
| **◀ Collapse** | Minify input to a single line / Collapse tree to top level |
| **⟲ Unescape** `Lx` | Remove one layer of backslash/string escaping per click (outer → inner). The `Lx` badge shows the current escape depth |
| **" Str** | Stringify mode toggle — while active, pasting valid JSON auto-converts it into an escaped JSON string literal |
| **" UnStr** | Unstringify all levels at once — recursively parses every nested JSON-encoded string down to the bottom |
| **" UnStr↑** | Unstringify one level per click — press repeatedly to peel off nested encoding one layer at a time |
| **{ } Parse** | Convert an unquoted `key:value` blob (e.g. copied from a log or webhook dump) into valid JSON |
| **⇌ Wrap** | Toggle word wrap for both the input editor and tree view (off by default) |
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

- If the entire input is a JSON-encoded string, it's unwrapped with `JSON.parse()` and pretty-printed.
- Otherwise, the parsed JSON tree is walked and any string value that is itself valid JSON (an object or array) is replaced with its parsed form — one layer per click, leaving the rest of the document untouched.
- If the input isn't valid JSON at all, it falls back to stripping one `\` before each `\"`.

The `Lx` badge (e.g. `L2`) next to the button shows how many escape levels are currently detected. It disappears when no escaping remains.

### Stringify / Unstringify

For working with JSON that needs to travel as a string (e.g. embedding one JSON document inside a field of another):

- **" Str** — toggles stringify mode. While active, pasting a valid JSON object/array into the input auto-converts it into an escaped string literal (`JSON.stringify(JSON.stringify(parsed))`) instead of pasting it raw.
- **" UnStr** — unstringifies every level in one click, recursively parsing any string value that is itself JSON, all the way down.
- **" UnStr↑** — same idea, but one level per click, so you can inspect each layer as you go.

### Loose Key:Value → JSON

The **{ } Parse** button converts a loose, unquoted object/array literal — the kind of thing you get pasting a struct dump from logs or a courier/webhook payload — into valid JSON:

```
{code:ABC123,price:15000,active:true,items:[{name:foo,ok:true}]}
```

becomes:

```json
{
  "code": "ABC123",
  "price": 15000,
  "active": true,
  "items": [
    { "name": "foo", "ok": true }
  ]
}
```

It infers numbers, booleans, and `null` from bare tokens and quotes everything else as a string — including values that contain literal commas (e.g. free-text descriptions), which it distinguishes from a new key by checking whether what follows the comma looks like `identifier:`.

---

## Keyboard Shortcuts

Global (registered VS Code commands — work regardless of focus, as long as the panel is visible):

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+=` | Expand |
| `Ctrl+Shift+-` | Collapse |
| `Ctrl+Shift+Up` | Unescape |

> Mac: replace `Ctrl` with `Cmd`.

Editor-only (active while the Input editor has focus):

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Open / close Find & Replace bar |
| `Ctrl+H` | Open / close Find & Replace bar |
| `Enter` (in Find box) | Next match |
| `Shift+Enter` (in Find box) | Previous match |
| `Escape` (in Find bar) | Close Find & Replace bar |
| `Tab` / `Shift+Tab` | Indent / dedent line or selection |
| `Ctrl+Alt+Up` / `Down` | Add cursor on the line above / below |
| `Ctrl+G` | Select next occurrence of the current word/selection |
| `Ctrl+Shift+[` / `]` | Fold / unfold the block at the cursor |
| `Ctrl+Alt+[` / `]` | Fold / unfold all |

> Mac: `Ctrl+Alt+Up/Down` → `Cmd+Option+Up/Down`, `Ctrl+G` → `Cmd+G`, `Ctrl+Shift+[`/`]` → `Cmd+Option+[`/`]`.

---

## Usage

1. Click the **JSON Formatter icon** in the Activity Bar (left sidebar)
2. Paste JSON (or an escaped/loose variant of it) into the **Input** editor
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
2. Select `json-formatter-0.6.0.vsix`
3. Reload VSCode when prompted

Or via terminal:
```bash
code --install-extension json-formatter-0.6.0.vsix
```
