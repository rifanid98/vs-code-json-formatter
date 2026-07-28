import { EditorState, EditorSelection, Compartment } from '@codemirror/state';
import { EditorView, keymap, drawSelection, placeholder, KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { indentUnit, indentOnInput, bracketMatching, HighlightStyle, syntaxHighlighting, foldGutter, foldKeymap, foldAll } from '@codemirror/language';
import { selectNextOccurrence } from '@codemirror/search';
import { tags } from '@lezer/highlight';

(function () {
  const editorHost       = document.getElementById('input-editor')!;
  const btnExpand        = document.getElementById('btn-expand') as HTMLButtonElement;
  const btnCollapse      = document.getElementById('btn-collapse') as HTMLButtonElement;
  const btnUnescape      = document.getElementById('btn-unescape') as HTMLButtonElement;
  const unescapeLevel    = document.getElementById('unescape-level')!;
  const btnStringify     = document.getElementById('btn-stringify') as HTMLButtonElement;
  const btnUnstringify    = document.getElementById('btn-unstringify') as HTMLButtonElement;
  const btnUnstringifyAll = document.getElementById('btn-unstringify-all') as HTMLButtonElement;
  const btnLooseJson     = document.getElementById('btn-loose-json') as HTMLButtonElement;
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

  // Keys, strings, numbers/booleans, and null each get a distinct color
  const jsonHighlightStyle = HighlightStyle.define([
    { tag: tags.propertyName, color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
    { tag: tags.string,       color: 'var(--vscode-gitDecoration-addedResourceForeground, #ce9178)' },
    { tag: tags.number,       color: 'var(--vscode-charts-yellow, #dcdcaa)' },
    { tag: tags.bool,         color: 'var(--vscode-charts-green, #b5cea8)' },
    { tag: tags.null,         color: 'var(--vscode-descriptionForeground, #569cd6)', fontStyle: 'italic' },
  ]);

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
        syntaxHighlighting(jsonHighlightStyle),
        foldGutter({ openText: '▾', closedText: '▸' }),
        wrapCompartment.of([]),
        placeholder('Paste JSON here…'),
        EditorView.contentAttributes.of({ spellcheck: 'false' }),
        keymap.of([...multiCursorKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            updateUnescapeLevel();
          }, 300);
        }),
        EditorView.domEventHandlers({
          paste: (event, v) => {
            const text = event.clipboardData?.getData('text');
            if (!text) return false;
            const trimmed = text.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
            try {
              const parsed = JSON.parse(trimmed);
              // Stringify mode: paste as an escaped string literal instead of raw JSON
              const insert = stringifyMode
                ? JSON.stringify(JSON.stringify(parsed))
                : JSON.stringify(parsed, null, 2); // default: auto-expand so the fold/tree feature is immediately usable
              const { from, to } = v.state.selection.main;
              v.dispatch({
                changes: { from, to, insert },
                selection: { anchor: from + insert.length },
              });
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
            backgroundColor: 'var(--vscode-editor-background)',
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
          '.cm-gutters': {
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-descriptionForeground, #888)',
            border: 'none',
          },
          '.cm-foldGutter span': {
            cursor: 'pointer',
            color: 'var(--vscode-descriptionForeground, #888)',
          },
          '.cm-foldGutter span:hover': {
            color: 'var(--vscode-editor-foreground)',
          },
          '.cm-foldPlaceholder': {
            backgroundColor: 'var(--vscode-badge-background, #4d4d4d)',
            color: 'var(--vscode-badge-foreground, #dcdcaa)',
            border: 'none',
            borderRadius: '3px',
            padding: '0 4px',
            margin: '0 2px',
            cursor: 'pointer',
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
    runFind();
  });

  btnReplaceAll.addEventListener('click', () => {
    const needle = findInput.value;
    if (!needle) return;
    const rep = replaceInput.value;
    setValue(getValue().split(needle).join(rep));
    runFind();
  });

  // Expand button — pretty-print (2-space indent)
  btnExpand.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(getValue());
      setValue(JSON.stringify(parsed, null, 2));
    } catch (_) { /* ignore invalid JSON */ }
  });

  // Collapse button — minify to a single line
  btnCollapse.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(getValue());
      setValue(JSON.stringify(parsed));
    } catch (_) { /* ignore invalid JSON */ }
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

  // Parse a loose, unquoted key:value object/array literal (e.g. copied from a Go/log
  // dump like {key:value,nested:{a:1},list:[{b:2}]}) into a proper JS value.
  // Keys and scalar values carry no quotes, so string boundaries are inferred:
  //   - a comma inside an object value only ends the value if what follows looks like
  //     `identifier:` (a new key) — otherwise it's kept as part of the string
  //   - a comma inside an array element always ends that element
  function parseLooseValue(input: string): any {
    let i = 0;
    const n = input.length;
    const keyLookahead = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:/;

    function skipWs(): void {
      while (i < n && /\s/.test(input[i])) i++;
    }

    function parseValue(inArray: boolean): any {
      skipWs();
      if (input[i] === '{') return parseObject();
      if (input[i] === '[') return parseArray();
      return parseScalar(inArray);
    }

    function parseKey(): string {
      const start = i;
      while (i < n && input[i] !== ':') i++;
      return input.slice(start, i).trim();
    }

    function parseScalar(inArray: boolean): any {
      const start = i;
      while (i < n) {
        const ch = input[i];
        if (ch === '}' || ch === ']') break;
        if (ch === ',') {
          if (inArray || keyLookahead.test(input.slice(i + 1))) break;
        }
        i++;
      }
      return convertScalar(input.slice(start, i).trim());
    }

    function convertScalar(raw: string): any {
      if (raw === '') return '';
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      if (raw === 'null') return null;
      if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
      if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
      return raw;
    }

    function parseObject(): any {
      i++; // skip '{'
      const obj: Record<string, any> = {};
      skipWs();
      if (input[i] === '}') { i++; return obj; }
      while (true) {
        skipWs();
        const key = parseKey();
        if (input[i] === ':') i++;
        obj[key] = parseValue(false);
        skipWs();
        if (input[i] === ',') { i++; continue; }
        if (input[i] === '}') { i++; }
        break;
      }
      return obj;
    }

    function parseArray(): any {
      i++; // skip '['
      const arr: any[] = [];
      skipWs();
      if (input[i] === ']') { i++; return arr; }
      while (true) {
        arr.push(parseValue(true));
        skipWs();
        if (input[i] === ',') { i++; continue; }
        if (input[i] === ']') { i++; }
        break;
      }
      return arr;
    }

    skipWs();
    return parseValue(false);
  }

  // Loose-object → JSON button: converts an unquoted key:value blob into valid JSON
  btnLooseJson.addEventListener('click', () => {
    const raw = getValue().trim();
    if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) return;
    try { JSON.parse(raw); return; } catch (_) { /* not already valid JSON, proceed */ }
    try {
      const parsed = parseLooseValue(raw);
      setValue(JSON.stringify(parsed, null, 2));
      updateUnescapeLevel();
    } catch (_) { /* malformed input — leave untouched */ }
  });

  // Unstringify all levels at once
  btnUnstringify.addEventListener('click', () => {
    const raw = getValue().trim();
    if (!raw) return;
    const parsed = tryParse(raw);
    if (parsed === undefined) return;
    setValue(JSON.stringify(deepUnstringify(parsed), null, 2));
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
      updateUnescapeLevel();
    }
  });

  // Wrap toggle
  let wrapEnabled = false;
  btnWrap.addEventListener('click', () => {
    wrapEnabled = !wrapEnabled;
    view.dispatch({ effects: wrapCompartment.reconfigure(wrapEnabled ? [EditorView.lineWrapping] : []) });
    btnWrap.classList.toggle('btn-active', wrapEnabled);
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    setValue('');
  });

  // VS Code command bridge
  window.addEventListener('message', event => {
    const { type } = event.data;
    if (type === 'expand')      btnExpand.click();
    // Cmd/Ctrl+Shift+- folds all blocks in the input editor (the fold/tree feature),
    // independent of the ◀ Collapse button, which still minifies to a single line.
    else if (type === 'collapse')    foldAll(view);
    else if (type === 'stripQuotes') btnUnescape.click();
  });
}());
