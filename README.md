# JSON Formatter

A VSCode side panel JSON formatter. Paste raw JSON into the input, transform it in place, and explore the structure with an interactive collapsible tree.

---

## Features

### Input Panel
Paste any raw or escaped JSON into the textarea. All transform operations work directly on this text.

### Interactive Tree View
The parsed JSON is rendered as a collapsible tree below the input. All nodes start collapsed to the top level — click any `▶` arrow to expand a node, `▼` to collapse it.

### Toolbar Buttons

| Button | Input Panel | Tree View |
|---|---|---|
| **▶ Expand** | Pretty-print (indent 2 spaces) | Expand all nodes |
| **◀ Collapse** | Minify to single line | Collapse all to top level |
| **⟲ Unescape** | Convert `\"` → `"` | Convert `\"` → `"` |
| **⎘ Copy** | Copy raw input text to clipboard | Copy raw input text to clipboard |
| **✕ Clear** | Clear input and tree | Clear input and tree |

> Buttons act on the **last clicked pane** — click the textarea first to transform text, click the tree first to expand/collapse nodes.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+=` | Expand |
| `Ctrl+Shift+-` | Collapse |
| `Ctrl+Shift+Up` | Unescape |

> Mac: replace `Ctrl` with `Cmd`.

---

## Usage

1. Click the **JSON Formatter icon** in the Activity Bar (left sidebar)
2. Paste JSON into the **Input** textarea
3. The tree view renders automatically as you type
4. Use buttons or keyboard shortcuts to transform

### Example — Unescape escaped JSON

Input:
```
[{\"usersUpdated\":2}]
```

After **Unescape**:
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
vsce package
```

This produces `json-formatter-x.x.x.vsix` in the project root.

---

## Installation

Install from the VSIX file:

1. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
2. Select `json-formatter-0.1.0.vsix`
3. Reload VSCode when prompted
