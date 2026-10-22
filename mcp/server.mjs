#!/usr/bin/env node
// Gota · MCP server (stdio). Lets AI agents (Claude Code, Cursor, Claude Desktop…) find Gota icons by
// meaning and insert the exact SVG or component code. No dependencies: MCP is JSON-RPC 2.0, one
// message per line on stdin/stdout. Run `node scripts/build.mjs` first (it reads dist/).
//
// Tools:
//   search_icons    { query, limit?, category? }       → names, labels and categories, best first
//   get_icon        { name, format?, variant?, weight?, enclosure?, slash?, size?, animate?, play? }
//                   format: svg (default) | react | data
//   list_categories {}                                  → categories and their icon counts
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const ROOT = new URL('../', import.meta.url).pathname;
const { categories, icons, toSvg, resolveIcon } = await import(`${ROOT}dist/index.js`);
const { searchIcons } = await import(`${ROOT}dist/search.js`);
const meta = JSON.parse(readFileSync(`${ROOT}dist/icons.json`, 'utf8'));
const VERSION = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).version;

const TOOLS = [
  {
    name: 'search_icons',
    description: 'Search Gota icons by meaning, in English or Spanish (e.g. "notifications", "cobrar", "upload file"). Returns icon names, labels and categories, best match first.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the icon should mean or show.' },
        limit: { type: 'number', description: 'Maximum results (default 12).' },
        category: { type: 'string', description: 'Optional category id to search within.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_icon',
    description: 'Get one Gota icon as ready-to-paste code: an SVG, a React snippet using @flouvia/gota/react, or its raw data. Supports fill, weights, enclosures, slash, 16 px pixel fitting and motion.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Icon name from search_icons (kebab-case).' },
        format: { type: 'string', enum: ['svg', 'react', 'data'], description: 'Default svg.' },
        variant: { type: 'string', enum: ['outline', 'fill'] },
        weight: { description: '"light", "regular", "bold" or a number (stroke width on the 24 grid).' },
        enclosure: { type: 'string', enum: ['circle', 'square'] },
        slash: { type: 'boolean' },
        size: { type: 'number', description: 'Render size in px; 16–18 uses the pixel-fitted drawing.' },
        animate: { type: 'string', enum: ['auto', 'draw', 'levels', 'ring', 'wiggle', 'spin', 'beat', 'slide', 'float', 'bounce'] },
        play: { type: 'string', enum: ['hover', 'once', 'loop'] },
      },
      required: ['name'],
    },
  },
  { name: 'list_categories', description: 'List Gota icon categories and how many icons each has.', inputSchema: { type: 'object', properties: {} } },
];

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

function call(name, args = {}) {
  if (name === 'search_icons') {
    const results = searchIcons(args.query ?? '', { limit: args.limit ?? 12, category: args.category });
    if (!results.length) return text(`No icons match "${args.query}".`);
    return text(results.map((r) => `${r.name} — ${r.label.en ?? ''}${r.label.es ? ` / ${r.label.es}` : ''} (${r.category})`).join('\n'));
  }
  if (name === 'get_icon') {
    if (!icons[args.name]) {
      const near = searchIcons(String(args.name ?? '').replace(/-/g, ' '), { limit: 5 }).map((r) => r.name);
      return fail(`Unknown icon "${args.name}".${near.length ? ` Did you mean: ${near.join(', ')}?` : ''}`);
    }
    const opts = { variant: args.variant, weight: args.weight, enclosure: args.enclosure ?? null, slash: Boolean(args.slash), size: args.size, animate: args.animate ?? null, play: args.play ?? 'hover' };
    if (args.format === 'data') return text(JSON.stringify({ name: args.name, ...meta[resolveIcon(args.name, opts).name] }, null, 2));
    if (args.format === 'react') {
      const props = Object.entries({ name: args.name, variant: opts.variant, weight: opts.weight, enclosure: opts.enclosure, effect: opts.animate, play: opts.animate ? opts.play : null })
        .filter(([, v]) => v !== undefined && v !== null && v !== 'outline' && v !== 'regular')
        .map(([k, v]) => (typeof v === 'string' ? `${k}="${v}"` : `${k}={${JSON.stringify(v)}}`));
      if (opts.slash) props.push('slash');
      return text(`import { Icon } from '@flouvia/gota/react';\n\n<Icon ${props.join(' ')} />`);
    }
    return text(toSvg(args.name, opts));
  }
  if (name === 'list_categories') return text(categories.map((c) => `${c.id} — ${c.label} (${c.icons.length})`).join('\n'));
  return fail(`Unknown tool "${name}".`);
}

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications (initialized, cancelled…) need no answer
  try {
    if (method === 'initialize')
      return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'gota', version: VERSION } } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') return send({ jsonrpc: '2.0', id, result: call(params?.name, params?.arguments) });
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
});
