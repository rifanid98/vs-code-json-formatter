import * as vscode from 'vscode';

export class JsonFormatterPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jsonFormatter.panel';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
    }

    public postMessage(message: { type: string }): void {
        this._view?.webview.postMessage(message);
    }

    private _getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js')
        );
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JSON Formatter</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
  }

  #toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    flex-shrink: 0;
  }

  #toolbar button {
    padding: 3px 8px;
    font-size: 12px;
    background: var(--vscode-button-secondaryBackground, #3a3a3a);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  #toolbar button:hover {
    background: var(--vscode-button-secondaryHoverBackground, #4a4a4a);
  }

  #btn-find {
    font-size: 13px;
  }

  #toolbar button.btn-active {
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
  }

  #toolbar button.btn-active:hover {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }

  /* ── Accordion sections ─────────────────────────────────────────────── */

  #panels-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .section.expanded {
    flex: 1;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-editor-foreground));
    background: var(--vscode-sideBarSectionHeader-background, transparent);
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  .section-header:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
  }

  .section-chevron {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    display: inline-block;
    transition: transform 0.12s ease;
    width: 12px;
    text-align: center;
  }

  .section.collapsed .section-chevron {
    transform: rotate(-90deg);
  }

  .section-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .section.collapsed .section-body {
    display: none;
  }

  .section-body.focused {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }

  /* ── Sash (resize handle) ─────────────────────────────────────────────── */

  #sash {
    height: 4px;
    flex-shrink: 0;
    cursor: ns-resize;
    background: var(--vscode-panel-border, #333);
    position: relative;
    z-index: 10;
    transition: background 0.1s;
  }

  #sash:hover, #sash.dragging {
    background: var(--vscode-sash-hoverBorder, #007fd4);
  }

  /* ── Input editor (CodeMirror) ─────────────────────────────────────── */

  #input-editor {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  #input-editor .cm-editor {
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  #input-editor .cm-scroller {
    overflow: auto;
  }

  /* ── Tree body ─────────────────────────────────────────────────────── */

  #tree-body {
    overflow-y: auto;
    overflow-x: auto;
    flex: 1;
  }

  #tree {
    padding: 6px 8px;
  }

  #tree ul {
    list-style: none;
    padding-left: 1.4em;
  }

  #tree > ul {
    padding-left: 0;
  }

  #tree li {
    line-height: 1.7;
    white-space: nowrap;
  }

  #tree.wrap-on li {
    white-space: normal;
    word-break: break-all;
  }

  .toggle {
    cursor: pointer;
    display: inline-block;
    width: 1.2em;
    color: var(--vscode-descriptionForeground, #888);
    user-select: none;
    font-size: 0.85em;
  }

  .toggle:hover {
    color: var(--vscode-editor-foreground);
  }

  .key {
    color: var(--vscode-symbolIcon-variableForeground, #9cdcfe);
  }

  .val-string {
    color: var(--vscode-gitDecoration-addedResourceForeground, #ce9178);
  }

  .val-primitive {
    color: var(--vscode-charts-orange, #b5cea8);
  }

  .val-null {
    color: var(--vscode-descriptionForeground, #569cd6);
    font-style: italic;
  }

  .badge {
    color: var(--vscode-descriptionForeground, #666);
    font-size: 0.85em;
    margin-left: 2px;
  }

  .level-badge {
    display: none;
    font-size: 10px;
    font-family: monospace;
    color: var(--vscode-charts-yellow, #dcdcaa);
    background: var(--vscode-badge-background, #4d4d4d);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: -2px;
    vertical-align: middle;
  }

  .level-badge.visible {
    display: inline;
  }

  .error-msg {
    color: var(--vscode-errorForeground, #f48771);
    font-size: 12px;
    padding: 4px 0;
    font-style: italic;
  }

  #find-bar {
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    flex-shrink: 0;
    background: var(--vscode-editor-background);
  }

  #find-bar.open { display: flex; }

  .find-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .find-row input[type="text"] {
    flex: 1;
    padding: 3px 6px;
    font-size: 12px;
    font-family: inherit;
    background: var(--vscode-input-background, #1e1e1e);
    color: var(--vscode-input-foreground, #d4d4d4);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 3px;
    outline: none;
  }

  .find-row input[type="text"]:focus {
    border-color: var(--vscode-focusBorder, #007fd4);
  }

  .find-row button {
    padding: 3px 8px;
    font-size: 12px;
    background: var(--vscode-button-secondaryBackground, #3a3a3a);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  .find-row button:hover {
    background: var(--vscode-button-secondaryHoverBackground, #4a4a4a);
  }

  .find-row button.primary {
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
  }

  .find-row button.primary:hover {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }

  #find-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    min-width: 4em;
    text-align: right;
    flex-shrink: 0;
  }

  mark {
    background: var(--vscode-editor-findMatchHighlightBackground, #9e6a03);
    color: inherit;
    border-radius: 2px;
  }

  mark.current {
    background: var(--vscode-editor-findMatchBackground, #f6b73c);
    outline: 1px solid var(--vscode-editor-findMatchBorder, #f6b73c);
  }
</style>
</head>
<body>

<div id="toolbar">
  <button id="btn-expand"   title="Expand / Pretty-print">▶ Expand</button>
  <button id="btn-collapse" title="Collapse / Minify">◀ Collapse</button>
  <button id="btn-unescape"    title='Unescape one level at a time (outer → inner)'>⟲ Unescape</button><span id="unescape-level" class="level-badge"></span>
  <button id="btn-stringify"      title="Stringify mode — auto-convert pasted JSON to an escaped string literal">" Str</button>
  <button id="btn-unstringify"     title="Unstringify all levels at once — recursively convert all nested escaped JSON strings">" UnStr</button>
  <button id="btn-unstringify-all" title="Unstringify one level per click — press repeatedly to go level by level">" UnStr↑</button>
  <button id="btn-wrap"        title="Toggle word wrap">⇌ Wrap</button>
  <button id="btn-copy"     title="Copy input to clipboard">⎘ Copy</button>
  <button id="btn-clear"    title="Clear all">✕ Clear</button>
  <button id="btn-find"     title="Find &amp; Replace (Ctrl+F / Ctrl+H)">⌕ Find</button>
</div>

<div id="find-bar">
  <div class="find-row">
    <input type="text" id="find-input" placeholder="Find…" autocomplete="off" spellcheck="false" />
    <span id="find-count"></span>
    <button id="btn-prev" title="Previous match">↑</button>
    <button id="btn-next" title="Next match">↓</button>
  </div>
  <div class="find-row">
    <input type="text" id="replace-input" placeholder="Replace…" autocomplete="off" spellcheck="false" />
    <button id="btn-replace"     title="Replace current match">Replace</button>
    <button id="btn-replace-all" class="primary" title="Replace all matches">All</button>
  </div>
</div>

<div id="panels-container">

<div id="input-section" class="section expanded">
  <div class="section-header" id="input-header">
    <span class="section-chevron">▾</span>
    <span class="section-title">Input</span>
  </div>
  <div class="section-body focused" id="input-body">
    <div id="input-editor"></div>
  </div>
</div>

<div id="sash"></div>

<div id="tree-section" class="section expanded">
  <div class="section-header" id="tree-header">
    <span class="section-chevron">▾</span>
    <span class="section-title">Tree</span>
  </div>
  <div class="section-body" id="tree-body">
    <div id="tree"></div>
  </div>
</div>

</div>

<script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
