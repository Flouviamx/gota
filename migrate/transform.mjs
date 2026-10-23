// Gota · the codemod's transforms, run by ./cli.mjs (gota-migrate). Text in; the new text, each edit,
// and notes out. Nothing here touches files.
//   transformScript(code)  JS, TS, JSX, Vue, and Astro: named imports from lucide-react,
//                          lucide-vue-next, @heroicons/react and @heroicons/vue become Gota's per-icon
//                          components (@flouvia/gota/react/icons, /vue/icons) under the same local
//                          names, so the code that uses them doesn't change; every tag gets the props
//                          its equivalent needs (variant, enclosure, slash), and Lucide's strokeWidth
//                          becomes a named weight.
//   transformSwift(code)   SF Symbols in Swift: Image(systemName:), UIImage(systemName:),
//                          NSImage(systemSymbolName:accessibilityDescription:) and Label(_:systemImage:)
//                          take Gota's Xcode symbols (Gota.xcassets) by name.
// Whatever can't be carried over safely stays as it was, with a note: an icon with no equivalent yet,
// an icon passed around as a value (its props can't follow it), a stroke width that isn't a number.
import { iconData, resolveIcon } from '../dist/index.js';
import { fromHeroicons, fromLucide, fromSFSymbol } from '../dist/migrate.js';

const pascal = (kebab) =>
  kebab
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
/** Gota's per-icon export for a name (bell-off → BellOffIcon), as scripts/build.mjs writes it. */
export const exportName = (name) => `${pascal(name)}Icon`;
// Vue's own hyphenation of a component name, for tags written in kebab-case
const hyphenate = (name) => name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineAt = (text, i) => text.slice(0, i).split('\n').length;

const SOURCES = [
  [/^lucide-react$/, 'lucide', 'react'],
  [/^lucide-vue-next$/, 'lucide', 'vue'],
  [/^@heroicons\/react\/(?:24\/(?:outline|solid)|20\/solid|16\/solid)$/, 'heroicons', 'react'],
  [/^@heroicons\/vue\/(?:24\/(?:outline|solid)|20\/solid|16\/solid)$/, 'heroicons', 'vue'],
];
const TARGET = { react: '@flouvia/gota/react/icons', vue: '@flouvia/gota/vue/icons' };
// Lucide's exports that aren't icons
const NOT_ICONS = new Set(['Icon', 'icons', 'createLucideIcon', 'LucideIcon', 'LucideProps', 'LucideProvider', 'IconNode', 'createIcons', 'dynamicIconImports']);
const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*(['"])([^'"]+)\3\s*;?/g;
// Any other way of reaching these packages (a namespace, a default, a deep path, require) is noted
const ELSEWHERE = /(?:from\s*|require\(\s*|import\(\s*)(['"])((?:lucide-[a-z-]+|@heroicons\/[a-z]+)[^'"]*)\1/g;

/** Where an opening tag that starts at i ends (its '>'), past braces and quoted values. */
function tagEnd(s, i) {
  let depth = 0;
  let quote = null;
  for (let k = i + 1; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === quote && s[k - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return k;
  }
  return -1;
}

// Lucide draws at stroke 2; Gota's named weights sit on the same steps of its own scale
function weightFor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || value === '') return null;
  return n <= 1.5 ? ' weight="light"' : n >= 2.5 ? ' weight="bold"' : '';
}
const STROKE = /\s:?(?:strokeWidth|stroke-width)=("[^"]*"|'[^']*'|\{[^}]*\})/;
const ABSOLUTE = /\s:?(?:absoluteStrokeWidth|absolute-stroke-width)(?:=("[^"]*"|\{[^}]*\}))?/;

/** Moves a script's Lucide and Heroicons imports to Gota. Returns { code, edits, notes }. */
export function transformScript(code) {
  const edits = [];
  const notes = [];
  const icons = new Map(); // local name → { attrs, lucide }
  const handled = new Set();
  for (const m of code.matchAll(IMPORT)) {
    const [statement, typeOnly, list, q, from] = m;
    const source = SOURCES.find(([re]) => re.test(from));
    if (!source) continue;
    handled.add(m.index);
    if (typeOnly) continue;
    const [, set, framework] = source;
    const style = set === 'heroicons' && !from.endsWith('/outline') ? 'solid' : 'outline';
    const kept = [];
    const moved = [];
    for (const raw of list
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const spec = raw.match(/^(type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!spec || spec[1] || (set === 'lucide' && NOT_ICONS.has(spec[2]))) {
        kept.push(raw);
        continue;
      }
      const [, , imported, local = imported] = spec;
      const eq = set === 'lucide' ? fromLucide(imported) : fromHeroicons(imported, { style });
      if (!eq) {
        kept.push(raw);
        notes.push(`${lineAt(code, m.index)}: ${imported} has no Gota equivalent yet; it stays on ${from}`);
        continue;
      }
      const name = exportName(eq.name);
      moved.push(name === local ? name : `${name} as ${local}`);
      const attrs = [eq.variant && `variant="${eq.variant}"`, eq.enclosure && `enclosure="${eq.enclosure}"`, eq.slash && 'slash'].filter(Boolean).join(' ');
      icons.set(local, { attrs, lucide: set === 'lucide', vue: framework === 'vue' });
    }
    if (!moved.length) continue;
    const list2 = (items) => (items.length > 3 ? `{\n  ${items.join(',\n  ')},\n}` : `{ ${items.join(', ')} }`);
    const after = [kept.length && `import ${list2(kept)} from ${q}${from}${q};`, `import ${list2(moved)} from ${q}${TARGET[framework]}${q};`].filter(Boolean).join('\n');
    edits.push({ start: m.index, end: m.index + statement.length, before: statement, after, line: lineAt(code, m.index) });
  }
  for (const m of code.matchAll(ELSEWHERE)) {
    const start = code.lastIndexOf('import', m.index);
    if ([...handled].some((h) => h === start)) continue;
    notes.push(`${lineAt(code, m.index)}: ${m[2]} is imported in a way the codemod doesn't move (a namespace, a default, a deep path or require); see @flouvia/gota/migrate`);
  }

  for (const [local, { attrs, lucide, vue }] of icons) {
    for (const tag of vue ? [local, hyphenate(local)] : [local]) {
      for (const m of code.matchAll(new RegExp(`<${escape(tag)}(?=[\\s/>])`, 'g'))) {
        const end = tagEnd(code, m.index);
        if (end < 0) continue;
        const before = code.slice(m.index, end + 1);
        let after = attrs ? before.replace(`<${tag}`, `<${tag} ${attrs}`) : before;
        if (lucide) {
          const width = after.match(STROKE);
          if (width) {
            const weight = weightFor(width[1].replace(/^[{"']\s*|\s*[}"']$/g, ''));
            if (weight === null) notes.push(`${lineAt(code, m.index)}: ${local} keeps strokeWidth=${width[1]}: Gota takes weight ("light", "regular", "bold", or 0.9–2.1)`);
            else after = after.replace(STROKE, weight);
          }
          if (ABSOLUTE.test(after)) {
            after = after.replace(ABSOLUTE, '');
            notes.push(`${lineAt(code, m.index)}: ${local}'s absoluteStrokeWidth was removed: Gota keeps its weight at every size`);
          }
        }
        if (after !== before) edits.push({ start: m.index, end: end + 1, before, after, line: lineAt(code, m.index) });
      }
    }
    // Used as a value (passed as a prop, kept in a list): the props can't follow it there
    if (attrs) {
      const uses = [...code.matchAll(new RegExp(`(?<![\\w$.]|<|</)${escape(local)}(?![\\w$])`, 'g'))].filter((u) => !edits.some((e) => u.index >= e.start && u.index < e.end));
      if (uses.length) notes.push(`${lineAt(code, uses[0].index)}: ${local} is used as a value: give it ${attrs} where it renders`);
    }
  }

  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.after + out.slice(e.end);
  return { code: out, edits: edits.map(({ line, before, after }) => ({ line, before, after })), notes };
}

/** The Xcode symbol of Gota.xcassets for an SF Symbols name, or the reason there is none. */
export function xcodeSymbol(sfName) {
  const eq = fromSFSymbol(sfName);
  if (!eq) return { reason: 'no Gota equivalent yet' };
  const r = resolveIcon(eq.name, { enclosure: eq.enclosure ?? null, slash: Boolean(eq.slash) });
  if (r.enclosure || r.slash) return { reason: `Gota draws ${eq.name} with ${r.enclosure ? `a ${r.enclosure}` : 'a slash'} in code, not as an Xcode symbol` };
  return { symbol: eq.variant === 'fill' && iconData(r.name).fill ? `${r.name}.fill` : r.name };
}

const SWIFT = [
  [/\bUIImage\(\s*systemName:\s*"([^"\\]+)"\s*\)/g, (s) => `UIImage(named: "${s}")`],
  [/\bImage\(\s*systemName:\s*"([^"\\]+)"\s*\)/g, (s) => `Image("${s}")`],
  [/\bNSImage\(\s*systemSymbolName:\s*"([^"\\]+)"\s*,\s*accessibilityDescription:\s*[^()]*\)/g, (s) => `NSImage(named: "${s}")`, 'its accessibilityDescription was dropped: set it on the image'],
  [/\bLabel\(([^()]*?),\s*systemImage:\s*"([^"\\]+)"\s*\)/g, (s, title) => `Label(${title}, image: "${s}")`],
];

/** Moves SF Symbols in Swift to Gota's Xcode symbols. Returns { code, edits, notes }. */
export function transformSwift(code) {
  const edits = [];
  const notes = [];
  for (const [re, write, note] of SWIFT)
    for (const m of code.matchAll(re)) {
      if (edits.some((e) => m.index >= e.start && m.index < e.end)) continue;
      const label = re.source.startsWith('\\bLabel') ? m[1] : null;
      const sf = label === null ? m[1] : m[2];
      const { symbol, reason } = xcodeSymbol(sf);
      const line = lineAt(code, m.index);
      if (!symbol) {
        notes.push(`${line}: "${sf}" stays an SF Symbol: ${reason}`);
        continue;
      }
      edits.push({ start: m.index, end: m.index + m[0].length, before: m[0], after: write(symbol, label), line });
      if (note) notes.push(`${line}: "${sf}" → "${symbol}": ${note}`);
    }
  // Anything else that names an SF Symbol (Button(_:systemImage:), a variable…) is left with a note
  for (const m of code.matchAll(/\b(systemName|systemImage|systemSymbolName):\s*("[^"\\]+"|[A-Za-z_][\w.]*)/g)) {
    if (edits.some((e) => m.index >= e.start && m.index < e.end)) continue;
    const literal = m[2].startsWith('"') ? m[2].slice(1, -1) : null;
    const { symbol } = literal ? xcodeSymbol(literal) : {};
    if (symbol || !literal) notes.push(`${lineAt(code, m.index)}: ${m[1]}: ${m[2]} wasn't moved${symbol ? ` (Gota: "${symbol}")` : ': not a literal name'}`);
  }
  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.after + out.slice(e.end);
  return { code: out, edits: edits.map(({ line, before, after }) => ({ line, before, after })), notes };
}
