import * as vscode from 'vscode';

export class JsonFormatterPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jsonFormatter.panel';
    private _view?: vscode.WebviewView;

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();
    }

    public postMessage(message: { type: string }): void {
        this._view?.webview.postMessage(message);
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
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

  .pane {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    position: relative;
  }

  .pane.active {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }

  .pane-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    color: var(--vscode-descriptionForeground, #888);
    flex-shrink: 0;
    user-select: none;
  }

  #input {
    flex: 1;
    width: 100%;
    resize: none;
    border: none;
    outline: none;
    padding: 6px 8px;
    background: var(--vscode-input-background, #1e1e1e);
    color: var(--vscode-input-foreground, #d4d4d4);
    font-family: inherit;
    font-size: inherit;
    line-height: 1.5;
  }

  #input::placeholder {
    color: var(--vscode-input-placeholderForeground, #666);
  }

  #tree-pane {
    overflow-y: auto;
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

  .error-msg {
    color: var(--vscode-errorForeground, #f48771);
    font-size: 12px;
    padding: 4px 0;
    font-style: italic;
  }
</style>
</head>
<body>

<div id="toolbar">
  <button id="btn-expand"   title="Expand / Pretty-print">▶ Expand</button>
  <button id="btn-collapse" title="Collapse / Minify">◀ Collapse</button>
  <button id="btn-unescape" title='Unescape \\" → "'>⟲ Unescape</button>
  <button id="btn-copy"     title="Copy input to clipboard">⎘ Copy</button>
  <button id="btn-clear"    title="Clear all">✕ Clear</button>
</div>

<div id="input-pane" class="pane active">
  <div class="pane-label">Input</div>
  <textarea id="input" spellcheck="false" placeholder="Paste JSON here…"></textarea>
</div>

<div id="tree-pane" class="pane">
  <div class="pane-label">Tree</div>
  <div id="tree"></div>
</div>

<script>
(function () {
  const inputPane  = document.getElementById('input-pane');
  const treePaneEl = document.getElementById('tree-pane');
  const input      = document.getElementById('input');
  const tree       = document.getElementById('tree');
  const btnExpand   = document.getElementById('btn-expand');
  const btnCollapse = document.getElementById('btn-collapse');
  const btnUnescape = document.getElementById('btn-unescape');
  const btnCopy     = document.getElementById('btn-copy');
  const btnClear    = document.getElementById('btn-clear');

  let lastFocus = 'input';
  let debounceTimer = null;

  // Focus tracking
  inputPane.addEventListener('mousedown', () => setFocus('input'));
  treePaneEl.addEventListener('mousedown', () => setFocus('tree'));
  input.addEventListener('focus', () => setFocus('input'));

  function setFocus(pane) {
    lastFocus = pane;
    inputPane.classList.toggle('active', pane === 'input');
    treePaneEl.classList.toggle('active', pane === 'tree');
  }

  // Live parse on input (debounced 300ms)
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(parseAndRender, 300);
  });

  function parseAndRender() {
    tree.innerHTML = '';
    const raw = input.value.trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const ul = document.createElement('ul');
      ul.appendChild(renderNode(data, undefined, true));
      tree.appendChild(ul);
    } catch (e) {
      const msg = document.createElement('div');
      msg.className = 'error-msg';
      msg.textContent = 'Invalid JSON: ' + e.message;
      tree.appendChild(msg);
    }
  }

  function renderNode(value, key, isRoot) {
    const li = document.createElement('li');

    if (value !== null && typeof value === 'object') {
      const isArray  = Array.isArray(value);
      const entries  = isArray ? [...value.entries()] : Object.entries(value);
      const count    = entries.length;
      const brackets = isArray ? ['[', ']'] : ['{', '}'];

      const toggle = document.createElement('span');
      toggle.className = 'toggle';
      toggle.textContent = isRoot ? '▼' : '▶';

      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      if (key !== undefined) {
        keySpan.textContent = isArray ? '[' + key + ']: ' : '"' + key + '": ';
      }

      const openBracket = document.createElement('span');
      openBracket.textContent = brackets[0];

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = ' ' + count + (count === 1 ? ' item' : ' items');
      badge.style.display = isRoot ? 'none' : 'inline';

      const childUl = document.createElement('ul');
      childUl.style.display = isRoot ? 'block' : 'none';

      for (const [k, v] of entries) {
        childUl.appendChild(renderNode(v, isArray ? k : k, false));
      }

      const closeBracket = document.createElement('span');
      closeBracket.textContent = brackets[1];
      closeBracket.style.display = isRoot ? 'none' : 'inline';

      toggle.addEventListener('click', () => {
        const opening = childUl.style.display === 'none';
        childUl.style.display = opening ? 'block' : 'none';
        closeBracket.style.display = opening ? 'none' : 'inline';
        badge.style.display = opening ? 'none' : 'inline';
        toggle.textContent = opening ? '▼' : '▶';
      });

      li.append(toggle, keySpan, openBracket, badge, childUl, closeBracket);
    } else {
      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      if (key !== undefined) {
        keySpan.textContent = Array.isArray(key) ? '[' + key + ']: ' : '"' + key + '": ';
      }

      const valSpan = document.createElement('span');
      if (value === null) {
        valSpan.className = 'val-null';
        valSpan.textContent = 'null';
      } else if (typeof value === 'string') {
        valSpan.className = 'val-string';
        valSpan.textContent = '"' + value + '"';
      } else {
        valSpan.className = 'val-primitive';
        valSpan.textContent = String(value);
      }

      const indent = document.createElement('span');
      indent.style.display = 'inline-block';
      indent.style.width = '1.2em';

      li.append(indent, keySpan, valSpan);
    }

    return li;
  }

  // Expand button
  btnExpand.addEventListener('click', () => {
    if (lastFocus === 'input') {
      try {
        const parsed = JSON.parse(input.value);
        input.value = JSON.stringify(parsed, null, 2);
        parseAndRender();
      } catch (_) {}
    } else {
      tree.querySelectorAll('li > ul').forEach(ul => { ul.style.display = 'block'; });
      tree.querySelectorAll('.toggle').forEach(t  => { t.textContent = '▼'; });
      tree.querySelectorAll('.badge').forEach(b   => { b.style.display = 'none'; });
      tree.querySelectorAll('li > span:last-child').forEach(s => {
        if (s.textContent === ']' || s.textContent === '}') s.style.display = 'none';
      });
    }
  });

  // Collapse button
  btnCollapse.addEventListener('click', () => {
    if (lastFocus === 'input') {
      try {
        const parsed = JSON.parse(input.value);
        input.value = JSON.stringify(parsed);
        parseAndRender();
      } catch (_) {}
    } else {
      // Collapse everything, then re-open root level
      tree.querySelectorAll('li > ul').forEach(ul => { ul.style.display = 'none'; });
      tree.querySelectorAll('.toggle').forEach(t  => { t.textContent = '▶'; });
      tree.querySelectorAll('.badge').forEach(b   => { b.style.display = 'inline'; });
      tree.querySelectorAll('li > span:last-child').forEach(s => {
        if (s.textContent === ']' || s.textContent === '}') s.style.display = 'inline';
      });
      // Re-open the root ul
      const rootLi = tree.querySelector('ul > li');
      if (rootLi) {
        const rootUl = rootLi.querySelector('ul');
        if (rootUl) rootUl.style.display = 'block';
        const rootToggle = rootLi.querySelector('.toggle');
        if (rootToggle) rootToggle.textContent = '▼';
        const rootClose = rootLi.querySelector('li > span:last-child');
        if (rootClose && (rootClose.textContent === ']' || rootClose.textContent === '}')) {
          rootClose.style.display = 'none';
        }
        const rootBadge = rootLi.querySelector('.badge');
        if (rootBadge) rootBadge.style.display = 'none';
      }
    }
  });

  // Unescape button — always acts on textarea
  btnUnescape.addEventListener('click', () => {
    input.value = input.value.replace(/\\\\"/g, '"');
    parseAndRender();
  });

  // Copy button
  btnCopy.addEventListener('click', () => {
    if (input.value) {
      navigator.clipboard.writeText(input.value).catch(() => {});
    }
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    input.value = '';
    tree.innerHTML = '';
  });

  // VS Code command bridge
  window.addEventListener('message', event => {
    const { type } = event.data;
    if (type === 'expand')      btnExpand.click();
    else if (type === 'collapse')    btnCollapse.click();
    else if (type === 'stripQuotes') btnUnescape.click();
  });
}());
</script>
</body>
</html>`;
    }
}
