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

  /* ── Input textarea ─────────────────────────────────────────────────── */

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
    overflow-x: auto;
  }

  #input.wrap-on {
    overflow-x: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  #input::placeholder {
    color: var(--vscode-input-placeholderForeground, #666);
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
  <button id="btn-unescape" title='Unescape one level at a time (outer → inner)'>⟲ Unescape</button><span id="unescape-level" class="level-badge"></span>
  <button id="btn-wrap"     title="Toggle word wrap">⇌ Wrap</button>
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
    <textarea id="input" wrap="off" spellcheck="false" placeholder="Paste JSON here…"></textarea>
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

<script>
(function () {
  const inputSection   = document.getElementById('input-section');
  const treeSection    = document.getElementById('tree-section');
  const inputHeader    = document.getElementById('input-header');
  const treeHeader     = document.getElementById('tree-header');
  const inputBody      = document.getElementById('input-body');
  const treeBody       = document.getElementById('tree-body');
  const panelsContainer = document.getElementById('panels-container');
  const sash           = document.getElementById('sash');
  const input          = document.getElementById('input');
  const tree           = document.getElementById('tree');
  const btnExpand      = document.getElementById('btn-expand');
  const btnCollapse    = document.getElementById('btn-collapse');
  const btnUnescape    = document.getElementById('btn-unescape');
  const unescapeLevel  = document.getElementById('unescape-level');
  const btnWrap        = document.getElementById('btn-wrap');
  const btnCopy        = document.getElementById('btn-copy');
  const btnClear       = document.getElementById('btn-clear');
  const btnFind        = document.getElementById('btn-find');
  const findBar        = document.getElementById('find-bar');
  const findInput      = document.getElementById('find-input');
  const replaceInput   = document.getElementById('replace-input');
  const findCount      = document.getElementById('find-count');
  const btnPrev        = document.getElementById('btn-prev');
  const btnNext        = document.getElementById('btn-next');
  const btnReplace     = document.getElementById('btn-replace');
  const btnReplaceAll  = document.getElementById('btn-replace-all');

  let lastFocus = 'input';
  let debounceTimer = null;

  // ── Find & Replace state ──────────────────────────────────────────────
  let findMatches = [];   // [{start, end}]
  let findCurrent = -1;

  function findBarOpen() {
    return findBar.classList.contains('open');
  }

  btnFind.addEventListener('click', () => {
    const wasOpen = findBarOpen();
    findBar.classList.toggle('open');
    if (!wasOpen) {
      findInput.focus();
      findInput.select();
      runFind();
    } else {
      clearHighlights();
      findMatches = [];
      findCurrent = -1;
      findCount.textContent = '';
    }
  });

  // Close find bar with Escape
  findBar.addEventListener('keydown', e => {
    if (e.key === 'Escape') { btnFind.click(); input.focus(); }
    if (e.key === 'Enter' && e.target === findInput) {
      e.shiftKey ? stepMatch(-1) : stepMatch(1);
    }
  });

  // Toggle with Ctrl+F / Ctrl+H (and Cmd equivalents)
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'h')) {
      e.preventDefault();
      btnFind.click();
    }
  });

  findInput.addEventListener('input', () => { runFind(); });

  function runFind() {
    clearHighlights();
    findMatches = [];
    findCurrent = -1;
    const needle = findInput.value;
    if (!needle) { findCount.textContent = ''; return; }
    const text = input.value;
    let idx = 0;
    while ((idx = text.indexOf(needle, idx)) !== -1) {
      findMatches.push({ start: idx, end: idx + needle.length });
      idx += needle.length;
    }
    findCount.textContent = findMatches.length + ' found';
    if (findMatches.length) stepMatch(1);
  }

  function stepMatch(dir) {
    if (!findMatches.length) return;
    findCurrent = (findCurrent + dir + findMatches.length) % findMatches.length;
    const m = findMatches[findCurrent];
    input.focus();
    input.setSelectionRange(m.start, m.end);
    // Scroll the textarea to the match
    const linesBefore = input.value.substring(0, m.start).split('\\n').length - 1;
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = linesBefore * lineHeight - input.clientHeight / 2;
    findCount.textContent = (findCurrent + 1) + ' / ' + findMatches.length;
  }

  function clearHighlights() {
    // No DOM highlights needed — textarea selection is the highlight
  }

  btnPrev.addEventListener('click', () => stepMatch(-1));
  btnNext.addEventListener('click', () => stepMatch(1));

  btnReplace.addEventListener('click', () => {
    if (findCurrent < 0 || !findMatches.length) return;
    const m = findMatches[findCurrent];
    const rep = replaceInput.value;
    input.value = input.value.substring(0, m.start) + rep + input.value.substring(m.end);
    parseAndRender();
    runFind();
  });

  btnReplaceAll.addEventListener('click', () => {
    const needle = findInput.value;
    if (!needle) return;
    const rep = replaceInput.value;
    input.value = input.value.split(needle).join(rep);
    parseAndRender();
    runFind();
  });

  // ── Accordion toggle ─────────────────────────────────────────────────
  function toggleSection(section) {
    const collapsed = section.classList.toggle('collapsed');
    section.classList.toggle('expanded', !collapsed);
  }

  inputHeader.addEventListener('click', () => { toggleSection(inputSection); setFocus('input'); });
  treeHeader.addEventListener('click',  () => { toggleSection(treeSection);  setFocus('tree'); });

  // ── Sash drag to resize ───────────────────────────────────────────────
  let sashDragging = false;
  let sashStartY = 0;
  let sashStartH = 0;

  sash.addEventListener('mousedown', e => {
    sashDragging = true;
    sashStartY = e.clientY;
    sashStartH = inputBody.getBoundingClientRect().height;
    sash.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!sashDragging) return;
    const delta = e.clientY - sashStartY;
    const containerH = panelsContainer.getBoundingClientRect().height;
    const sashH = 4;
    const headerH = 22 * 2 + sashH;
    const available = containerH - headerH;
    const newH = Math.max(40, Math.min(available - 40, sashStartH + delta));
    inputSection.style.flex = 'none';
    inputSection.style.height = newH + 'px';
    treeSection.style.flex = '1';
    treeSection.style.height = '';
  });

  document.addEventListener('mouseup', () => {
    if (!sashDragging) return;
    sashDragging = false;
    sash.classList.remove('dragging');
  });

  // ── Focus tracking ────────────────────────────────────────────────────
  inputSection.addEventListener('mousedown', () => setFocus('input'));
  treeSection.addEventListener('mousedown',  () => setFocus('tree'));
  input.addEventListener('focus', () => setFocus('input'));

  function setFocus(pane) {
    lastFocus = pane;
    inputBody.classList.toggle('focused', pane === 'input');
    treeBody.classList.toggle('focused',  pane === 'tree');
  }

  // Live parse on input (debounced 300ms)
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      parseAndRender();
      updateUnescapeLevel();
    }, 300);
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

  // Returns the maximum number of consecutive backslashes before any " in text
  function detectEscapeLevel(text) {
    let maxLevel = 0;
    const re = /\\+"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const lvl = m[0].length - 1; // backslash count (exclude the ")
      if (lvl > maxLevel) maxLevel = lvl;
    }
    return maxLevel;
  }

  function updateUnescapeLevel() {
    const level = detectEscapeLevel(input.value);
    if (level > 0) {
      unescapeLevel.textContent = 'L' + level;
      unescapeLevel.classList.add('visible');
    } else {
      unescapeLevel.textContent = '';
      unescapeLevel.classList.remove('visible');
    }
  }

  // Walk a parsed JSON value and parse any string values that are valid JSON objects/arrays.
  // Returns { changed, value } — only the immediate children are inspected (one level per call).
  function unescapeJsonStrings(data) {
    if (Array.isArray(data)) {
      let changed = false;
      const value = data.map(item => {
        const r = unescapeValue(item);
        if (r.changed) changed = true;
        return r.value;
      });
      return { changed, value };
    }
    if (data !== null && typeof data === 'object') {
      let changed = false;
      const value = {};
      for (const [k, v] of Object.entries(data)) {
        const r = unescapeValue(v);
        if (r.changed) changed = true;
        value[k] = r.value;
      }
      return { changed, value };
    }
    return { changed: false, value: data };
  }

  function unescapeValue(v) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.startsWith('{') || t.startsWith('[')) {
        try { return { changed: true, value: JSON.parse(v) }; } catch (_) {}
      }
    } else if (v !== null && typeof v === 'object') {
      return unescapeJsonStrings(v);
    }
    return { changed: false, value: v };
  }

  // Unescape button — one level per click (outer → inner)
  btnUnescape.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) return;
    let newValue = raw;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') {
        // Entire input is a JSON-encoded string → unwrap and pretty-print if inner is valid JSON
        try {
          newValue = JSON.stringify(JSON.parse(parsed), null, 2);
        } catch (_) {
          newValue = parsed;
        }
      } else if (parsed !== null && typeof parsed === 'object') {
        // Walk the tree and parse string values that are JSON objects/arrays
        const result = unescapeJsonStrings(parsed);
        if (result.changed) newValue = JSON.stringify(result.value, null, 2);
      }
    } catch (_) {
      // Not valid JSON — strip one backslash level as a last resort
      newValue = raw.replace(/\\"/g, '"');
    }

    input.value = newValue;
    parseAndRender();
    updateUnescapeLevel();
  });

  // Copy button
  btnCopy.addEventListener('click', () => {
    if (input.value) {
      navigator.clipboard.writeText(input.value).catch(() => {});
    }
  });

  // Wrap toggle
  let wrapEnabled = false;
  btnWrap.addEventListener('click', () => {
    wrapEnabled = !wrapEnabled;
    input.setAttribute('wrap', wrapEnabled ? 'soft' : 'off');
    input.classList.toggle('wrap-on', wrapEnabled);
    tree.classList.toggle('wrap-on', wrapEnabled);
    treeBody.classList.toggle('wrap-on', wrapEnabled);
    btnWrap.classList.toggle('btn-active', wrapEnabled);
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
