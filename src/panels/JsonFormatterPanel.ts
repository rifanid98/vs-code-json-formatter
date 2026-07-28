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
  <button id="btn-loose-json"      title="Convert an unquoted key:value blob (e.g. copied from logs) into valid JSON">{ } Parse</button>
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

<div id="input-editor"></div>

<script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
