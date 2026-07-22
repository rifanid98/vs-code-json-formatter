import { EditorState, EditorSelection, Compartment } from '@codemirror/state';
import { EditorView, keymap, drawSelection, placeholder, KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { indentUnit, indentOnInput, bracketMatching } from '@codemirror/language';
import { selectNextOccurrence } from '@codemirror/search';

(function () {
  const inputSection    = document.getElementById('input-section')!;
  const treeSection     = document.getElementById('tree-section')!;
  const inputHeader     = document.getElementById('input-header')!;
  const treeHeader      = document.getElementById('tree-header')!;
  const inputBody       = document.getElementById('input-body')!;
  const treeBody        = document.getElementById('tree-body')!;
  const panelsContainer = document.getElementById('panels-container')!;
  const sash            = document.getElementById('sash')!;
  const editorHost       = document.getElementById('input-editor')!;
  const tree             = document.getElementById('tree')!;
  const btnExpand        = document.getElementById('btn-expand') as HTMLButtonElement;
  const btnCollapse      = document.getElementById('btn-collapse') as HTMLButtonElement;
  const btnUnescape      = document.getElementById('btn-unescape') as HTMLButtonElement;
  const unescapeLevel    = document.getElementById('unescape-level')!;
  const btnStringify     = document.getElementById('btn-stringify') as HTMLButtonElement;
  const btnUnstringify    = document.getElementById('btn-unstringify') as HTMLButtonElement;
  const btnUnstringifyAll = document.getElementById('btn-unstringify-all') as HTMLButtonElement;
  const btnWrap           = document.getElementById('btn-wrap') as HTMLButtonElement;
  const btnCopy        = document.getElementById('btn-copy') as HTMLButtonElement;
  const btnClear       = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnFind        = document.getElementById('btn-find') as HTMLButtonElement;
  const findBar        = document.getElementById('find-bar')!;
  const findInput      = document.getElementById('find-input') as HTMLInputElement;
  const replaceInput   = document.getElementById('replace-input') as HTMLInputElement;
  const findCount      = document.getElementById('find-count')!;
  const btnPrev        = document.getElementById('btn-prev') as HTMLButtonElement;
  const btnNext        = document.getElementById('btn-next') as HTMLButtonElement;
  const btnReplace     = document.getElementById('btn-replace') as HTMLButtonElement;
  const btnReplaceAll  = document.getElementById('btn-replace-all') as HTMLButtonElement;

  let lastFocus: 'input' | 'tree' = 'input';
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let stringifyMode = false;

  // ── Multi-cursor: add a cursor on the line above/below (Cmd/Ctrl+Alt+Up/Down) ──
  function addCursor(view: EditorView, dir: -1 | 1): boolean {
    const { state } = view;
    const existing = state.selection.ranges;
    const added: ReturnType<typeof EditorSelection.cursor>[] = [];
    for (const range of existing) {
      const line = state.doc.lineAt(range.head);
      const targetNo = line.number + dir;
      if (targetNo < 1 || targetNo > state.doc.lines) continue;
      const targetLine = state.doc.line(targetNo);
      const col = range.head - line.from;
      added.push(EditorSelection.cursor(Math.min(targetLine.from + col, targetLine.to)));
    }
    if (!added.length) return true;
    const all = [...existing, ...added];
    view.dispatch({
      selection: EditorSelection.create(all, all.length - 1),
      scrollIntoView: true,
    });
    return true;
  }

  const multiCursorKeymap: readonly KeyBinding[] = [
    { key: 'Mod-Alt-ArrowUp',   run: (v) => addCursor(v, -1) },
    { key: 'Mod-Alt-ArrowDown', run: (v) => addCursor(v, 1) },
    // Select the current word/selection, then repeat to add the next matching occurrence
    { key: 'Mod-g', run: selectNextOccurrence, preventDefault: true },
  ];

  const wrapCompartment = new Compartment();

  const view = new EditorView({
    parent: editorHost,
    state: EditorState.create({
      doc: '',
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        history(),
        drawSelection(),
        bracketMatching(),
        indentOnInput(),
        indentUnit.of('  '),
        json(),
        wrapCompartment.of([]),
        placeholder('Paste JSON here…'),
        EditorView.contentAttributes.of({ spellcheck: 'false' }),
        keymap.of([...multiCursorKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            parseAndRender();
            updateUnescapeLevel();
          }, 300);
        }),
        EditorView.domEventHandlers({
          focus: () => { setFocus('input'); },
          paste: (event, v) => {
            if (!stringifyMode) return false;
            const text = event.clipboardData?.getData('text');
            if (!text) return false;
            const trimmed = text.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
            try {
              const parsed = JSON.parse(trimmed);
              const stringified = JSON.stringify(JSON.stringify(parsed));
              const { from, to } = v.state.selection.main;
              v.dispatch({
                changes: { from, to, insert: stringified },
                selection: { anchor: from + stringified.length },
              });
              parseAndRender();
              updateUnescapeLevel();
              event.preventDefault();
              return true;
            } catch (_) {
              return false;
            }
          },
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            backgroundColor: 'var(--vscode-input-background, #1e1e1e)',
            color: 'var(--vscode-input-foreground, #d4d4d4)',
          },
          '.cm-content': {
            padding: '6px 8px',
            caretColor: 'var(--vscode-input-foreground, #d4d4d4)',
          },
          '.cm-scroller': {
            fontFamily: 'inherit',
          },
          '&.cm-focused': { outline: 'none' },
          '.cm-cursor, .cm-cursor-primary': {
            borderLeftColor: 'var(--vscode-input-foreground, #d4d4d4)',
          },
          '.cm-selectionBackground': {
            backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78) !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78) !important',
          },
          '.cm-placeholder': {
            color: 'var(--vscode-input-placeholderForeground, #666)',
          },
        }),
      ],
    }),
  });

  function getValue(): string {
    return view.state.doc.toString();
  }

  function setValue(text: string): void {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }

  // ── Find & Replace state ──────────────────────────────────────────────
  let findMatches: { start: number; end: number }[] = [];
  let findCurrent = -1;

  function findBarOpen(): boolean {
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
      findMatches = [];
      findCurrent = -1;
      findCount.textContent = '';
    }
  });

  // Close find bar with Escape
  findBar.addEventListener('keydown', e => {
    if (e.key === 'Escape') { btnFind.click(); view.focus(); }
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

  function runFind(): void {
    findMatches = [];
    findCurrent = -1;
    const needle = findInput.value;
    if (!needle) { findCount.textContent = ''; return; }
    const text = getValue();
    let idx = 0;
    while ((idx = text.indexOf(needle, idx)) !== -1) {
      findMatches.push({ start: idx, end: idx + needle.length });
      idx += needle.length;
    }
    findCount.textContent = findMatches.length + ' found';
    if (findMatches.length) stepMatch(1);
  }

  function stepMatch(dir: number): void {
    if (!findMatches.length) return;
    findCurrent = (findCurrent + dir + findMatches.length) % findMatches.length;
    const m = findMatches[findCurrent];
    view.focus();
    view.dispatch({ selection: { anchor: m.start, head: m.end }, scrollIntoView: true });
    findCount.textContent = (findCurrent + 1) + ' / ' + findMatches.length;
    // Restore focus to find bar so typing continues without interruption
    if (findBarOpen()) findInput.focus();
  }

  btnPrev.addEventListener('click', () => stepMatch(-1));
  btnNext.addEventListener('click', () => stepMatch(1));

  btnReplace.addEventListener('click', () => {
    if (findCurrent < 0 || !findMatches.length) return;
    const m = findMatches[findCurrent];
    const rep = replaceInput.value;
    view.dispatch({ changes: { from: m.start, to: m.end, insert: rep } });
    parseAndRender();
    runFind();
  });

  btnReplaceAll.addEventListener('click', () => {
    const needle = findInput.value;
    if (!needle) return;
    const rep = replaceInput.value;
    setValue(getValue().split(needle).join(rep));
    parseAndRender();
    runFind();
  });

  // ── Accordion toggle ─────────────────────────────────────────────────
  function toggleSection(section: Element): void {
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
    (inputSection as HTMLElement).style.flex = 'none';
    (inputSection as HTMLElement).style.height = newH + 'px';
    (treeSection as HTMLElement).style.flex = '1';
    (treeSection as HTMLElement).style.height = '';
  });

  document.addEventListener('mouseup', () => {
    if (!sashDragging) return;
    sashDragging = false;
    sash.classList.remove('dragging');
  });

  // ── Focus tracking ────────────────────────────────────────────────────
  inputSection.addEventListener('mousedown', () => setFocus('input'));
  treeSection.addEventListener('mousedown',  () => setFocus('tree'));

  function setFocus(pane: 'input' | 'tree'): void {
    lastFocus = pane;
    inputBody.classList.toggle('focused', pane === 'input');
    treeBody.classList.toggle('focused',  pane === 'tree');
  }

  function parseAndRender(): void {
    tree.innerHTML = '';
    const raw = getValue().trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const ul = document.createElement('ul');
      ul.appendChild(renderNode(data, undefined, true));
      tree.appendChild(ul);
    } catch (e: any) {
      const msg = document.createElement('div');
      msg.className = 'error-msg';
      msg.textContent = 'Invalid JSON: ' + e.message;
      tree.appendChild(msg);
    }
  }

  function renderNode(value: any, key: string | number | undefined, isRoot: boolean): HTMLLIElement {
    const li = document.createElement('li');

    if (value !== null && typeof value === 'object') {
      const isArray  = Array.isArray(value);
      const entries  = isArray ? [...(value as any[]).entries()] : Object.entries(value);
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
        const parsed = JSON.parse(getValue());
        setValue(JSON.stringify(parsed, null, 2));
        parseAndRender();
      } catch (_) { /* ignore invalid JSON */ }
    } else {
      tree.querySelectorAll('li > ul').forEach(ul => { (ul as HTMLElement).style.display = 'block'; });
      tree.querySelectorAll('.toggle').forEach(t  => { t.textContent = '▼'; });
      tree.querySelectorAll('.badge').forEach(b   => { (b as HTMLElement).style.display = 'none'; });
      tree.querySelectorAll('li > span:last-child').forEach(s => {
        if (s.textContent === ']' || s.textContent === '}') (s as HTMLElement).style.display = 'none';
      });
    }
  });

  // Collapse button
  btnCollapse.addEventListener('click', () => {
    if (lastFocus === 'input') {
      try {
        const parsed = JSON.parse(getValue());
        setValue(JSON.stringify(parsed));
        parseAndRender();
      } catch (_) { /* ignore invalid JSON */ }
    } else {
      // Collapse everything, then re-open root level
      tree.querySelectorAll('li > ul').forEach(ul => { (ul as HTMLElement).style.display = 'none'; });
      tree.querySelectorAll('.toggle').forEach(t  => { t.textContent = '▶'; });
      tree.querySelectorAll('.badge').forEach(b   => { (b as HTMLElement).style.display = 'inline'; });
      tree.querySelectorAll('li > span:last-child').forEach(s => {
        if (s.textContent === ']' || s.textContent === '}') (s as HTMLElement).style.display = 'inline';
      });
      // Re-open the root ul
      const rootLi = tree.querySelector('ul > li');
      if (rootLi) {
        const rootUl = rootLi.querySelector('ul');
        if (rootUl) (rootUl as HTMLElement).style.display = 'block';
        const rootToggle = rootLi.querySelector('.toggle');
        if (rootToggle) rootToggle.textContent = '▼';
        const rootClose = rootLi.querySelector('li > span:last-child');
        if (rootClose && (rootClose.textContent === ']' || rootClose.textContent === '}')) {
          (rootClose as HTMLElement).style.display = 'none';
        }
        const rootBadge = rootLi.querySelector('.badge');
        if (rootBadge) (rootBadge as HTMLElement).style.display = 'none';
      }
    }
  });

  // Returns the maximum number of consecutive backslashes before any " in text
  function detectEscapeLevel(text: string): number {
    let maxLevel = 0;
    const re = /\\+"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const lvl = m[0].length - 1; // backslash count (exclude the ")
      if (lvl > maxLevel) maxLevel = lvl;
    }
    return maxLevel;
  }

  function updateUnescapeLevel(): void {
    const level = detectEscapeLevel(getValue());
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
  function unescapeJsonStrings(data: any): { changed: boolean; value: any } {
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
      const value: any = {};
      for (const [k, v] of Object.entries(data)) {
        const r = unescapeValue(v);
        if (r.changed) changed = true;
        value[k] = r.value;
      }
      return { changed, value };
    }
    return { changed: false, value: data };
  }

  function unescapeValue(v: any): { changed: boolean; value: any } {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.startsWith('{') || t.startsWith('[')) {
        try { return { changed: true, value: JSON.parse(v) }; } catch (_) { /* not JSON */ }
      }
    } else if (v !== null && typeof v === 'object') {
      return unescapeJsonStrings(v);
    }
    return { changed: false, value: v };
  }

  // Unescape button — one level per click (outer → inner)
  btnUnescape.addEventListener('click', () => {
    const raw = getValue().trim();
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
      newValue = raw.replace(/\\\\"/g, '"');
    }

    setValue(newValue);
    parseAndRender();
    updateUnescapeLevel();
  });

  // Copy button
  btnCopy.addEventListener('click', () => {
    const text = getValue();
    if (text) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  });

  // Stringify mode toggle — when active, pasting valid JSON auto-converts it to an escaped string literal
  btnStringify.addEventListener('click', () => {
    stringifyMode = !stringifyMode;
    btnStringify.classList.toggle('btn-active', stringifyMode);
  });

  // Recursively parse any string value that is valid JSON (all levels)
  function deepUnstringify(value: any): any {
    if (typeof value === 'string') {
      try { return deepUnstringify(JSON.parse(value)); } catch (_) { /* not JSON */ }
      return value;
    }
    if (Array.isArray(value)) return value.map(deepUnstringify);
    if (value !== null && typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) out[k] = deepUnstringify(v);
      return out;
    }
    return value;
  }

  // Shared: try multiple strategies to parse raw input into a JS value
  function tryParse(raw: string): any {
    try { return JSON.parse(raw); } catch (_) { /* not JSON */ }
    try { return JSON.parse(raw.replace(/\\\\(.)/g, '$1')); } catch (_) { /* not JSON */ }
    if (raw.startsWith('"') && raw.endsWith('"')) {
      const inner = raw.slice(1, -1);
      try { return JSON.parse(inner); } catch (_) { /* not JSON */ }
      try { return JSON.parse(inner.replace(/\\\\(.)/g, '$1')); } catch (_) { /* not JSON */ }
    }
    return undefined;
  }

  // Unstringify all levels at once
  btnUnstringify.addEventListener('click', () => {
    const raw = getValue().trim();
    if (!raw) return;
    const parsed = tryParse(raw);
    if (parsed === undefined) return;
    setValue(JSON.stringify(deepUnstringify(parsed), null, 2));
    parseAndRender();
    updateUnescapeLevel();
  });

  // Unstringify one level per click — traverses full tree, parses each string once
  btnUnstringifyAll.addEventListener('click', () => {
    const raw = getValue().trim();
    if (!raw) return;
    const parsed = tryParse(raw);
    if (parsed === undefined) return;

    // Outer string literal: unwrap one level
    if (typeof parsed === 'string') {
      try {
        setValue(JSON.stringify(JSON.parse(parsed), null, 2));
      } catch (_) {
        setValue(parsed);
      }
      parseAndRender();
      updateUnescapeLevel();
      return;
    }

    // If tryParse used a fallback (raw wasn't clean JSON), always write the result
    let rawParseable = true;
    try { JSON.parse(raw); } catch (_) { rawParseable = false; }

    // Object/array: traverse entire tree, parse each string value once (no recursion into result)
    let changed = false;
    function oneLevelDeep(val: any): any {
      if (typeof val === 'string') {
        try { const p = JSON.parse(val); changed = true; return p; } catch (_) { /* not JSON */ }
        return val;
      }
      if (Array.isArray(val)) return val.map(oneLevelDeep);
      if (val !== null && typeof val === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(val)) out[k] = oneLevelDeep(v);
        return out;
      }
      return val;
    }
    const result = oneLevelDeep(parsed);
    if (changed || !rawParseable) {
      setValue(JSON.stringify(result, null, 2));
      parseAndRender();
      updateUnescapeLevel();
    }
  });

  // Wrap toggle
  let wrapEnabled = false;
  btnWrap.addEventListener('click', () => {
    wrapEnabled = !wrapEnabled;
    view.dispatch({ effects: wrapCompartment.reconfigure(wrapEnabled ? [EditorView.lineWrapping] : []) });
    tree.classList.toggle('wrap-on', wrapEnabled);
    treeBody.classList.toggle('wrap-on', wrapEnabled);
    btnWrap.classList.toggle('btn-active', wrapEnabled);
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    setValue('');
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
