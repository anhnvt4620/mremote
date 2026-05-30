import { useEffect, useRef } from 'preact/hooks';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/lang-go';
import { oneDark } from './editor-theme.js';

function langExt(lang) {
  switch (lang) {
    case 'javascript': case 'jsx': return javascript({ jsx: true });
    case 'typescript': case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'json': return json();
    case 'html': return html();
    case 'css': case 'scss': return css();
    case 'markdown': return markdown();
    case 'python': return python();
    case 'yaml': return yaml();
    case 'sql': return sql();
    case 'rust': return rust();
    case 'c': case 'cpp': return cpp();
    case 'go': return go();
    default: return [];
  }
}

export function CodeMirror({ value, onChange, language, onSave }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!hostRef.current) return;

    const saveBinding = onSave
      ? [{ key: 'Mod-s', preventDefault: true, run: () => { onSave(); return true; } }]
      : [];

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        oneDark,
        keymap.of([...saveBinding, indentWithTab, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        langExt(language),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const next = u.state.doc.toString();
            if (next !== valueRef.current) {
              valueRef.current = next;
              onChange?.(next);
            }
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: '"JetBrains Mono", Menlo, monospace' },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => view.destroy();
  }, [language, onSave]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === valueRef.current) return;
    valueRef.current = value;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value || '' } });
  }, [value]);

  return <div ref={hostRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}
