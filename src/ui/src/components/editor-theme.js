import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const palette = {
  bg: '#0d1117', fg: '#e6edf3', muted: '#7d8590',
  selection: 'rgba(230,138,110,0.25)', cursor: '#e68a6e', gutter: '#161b22',
  line: 'rgba(255,255,255,0.04)',
  string: '#a5d6a7', keyword: '#ff7b72', comment: '#6a737d',
  number: '#79c0ff', function: '#d2a8ff', variable: '#e6edf3',
  type: '#ffa657', tag: '#7ee787', attr: '#79c0ff', operator: '#ff7b72',
};

const themeBase = EditorView.theme({
  '&': { color: palette.fg, backgroundColor: palette.bg },
  '.cm-content': { caretColor: palette.cursor },
  '&.cm-focused .cm-cursor': { borderLeftColor: palette.cursor },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: palette.selection },
  '.cm-selectionBackground': { backgroundColor: palette.selection },
  '.cm-activeLine': { backgroundColor: palette.line },
  '.cm-gutters': { backgroundColor: palette.gutter, color: palette.muted, border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: palette.line },
  '.cm-foldPlaceholder': { background: 'transparent', border: 'none', color: palette.muted },
  '.cm-tooltip': { background: '#161b22', borderColor: '#30363d', color: palette.fg },
}, { dark: true });

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: palette.keyword },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: palette.variable },
  { tag: [t.function(t.variableName), t.labelName], color: palette.function },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: palette.number },
  { tag: [t.definition(t.name), t.separator], color: palette.fg },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: palette.type },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: palette.operator },
  { tag: [t.meta, t.comment], color: palette.comment, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: palette.attr, textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: palette.keyword },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: palette.number },
  { tag: [t.processingInstruction, t.string, t.inserted], color: palette.string },
  { tag: t.invalid, color: '#f85149' },
  { tag: [t.tagName], color: palette.tag },
  { tag: [t.attributeName], color: palette.attr },
]);

export const oneDark = [themeBase, syntaxHighlighting(highlight)];
