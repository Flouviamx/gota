// Gota · MCP, shared by both transports: the tools, and the JSON-RPC 2.0 dispatch (one message or a
// batch in, its answers out). The transports only move messages: stdio (./server.mjs, `gota-mcp`) and
// Streamable HTTP (api/mcp.mjs, the remote server at gota.flouvia.com/mcp). No dependencies; it reads
// dist/, so it runs after `node scripts/build.mjs`.
//
// Tools:
//   search_icons    { query, limit?, category? }       → names, labels and categories, best first
//   get_icon        { name, format?, variant?, weight?, enclosure?, slash?, size?, animate?, play? }
//                   format: svg (default) | react | data
//   list_categories {}                                  → categories and their icon counts
import { readFileSync } from 'node:fs';
import { categories, icons, resolveIcon, toSvg } from '../dist/index.js';
import { searchIcons } from '../dist/search.js';

const meta = JSON.parse(readFileSync(new URL('../dist/icons.json', import.meta.url), 'utf8'));
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** MCP versions this server speaks, newest first: a client asking for one gets it back, any other the newest. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const PARSE_ERROR = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };

const MAX_RESULTS = 50;
const INSTRUCTIONS =
  'Gota is an icon library by Flouvia (MIT): one color (currentColor) on a 24 px grid, outline or fill, weights from light to bold. ' +
  'Find icons with search_icons (by meaning, in English or Spanish), then insert one with get_icon: an SVG, or a React line using @flouvia/gota/react.';
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'search_icons',
    title: 'Search icons',
    description: 'Search Gota icons by meaning, in English or Spanish (e.g. "notifications", "cobrar", "upload file"). Returns icon names, labels and categories, best match first.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the icon should mean or show.' },
        limit: { type: 'number', description: `Maximum results (default 12, at most ${MAX_RESULTS}).` },
        category: { type: 'string', description: 'Optional category id to search within (see list_categories).' },
      },
      required: ['query'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_icon',
    title: 'Get an icon',
    description: 'Get one Gota icon as ready-to-paste code: an SVG, a React snippet using @flouvia/gota/react, or its raw data. Supports fill, weights, enclosures, slash, 16 px pixel fitting and motion.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Icon name from search_icons (kebab-case).' },
        format: { type: 'string', enum: ['svg', 'react', 'data'], description: 'Default svg.' },
        variant: { type: 'string', enum: ['outline', 'fill'] },
        weight: { description: '"light", "regular", "bold" or a number (stroke width on the 24 grid, 0.9 to 2.1).' },
        enclosure: { type: 'string', enum: ['circle', 'square'] },
        slash: { type: 'boolean' },
        size: { type: 'number', description: 'Render size in px; 16–18 uses the pixel-fitted drawing.' },
        animate: { type: 'string', enum: ['auto', 'draw', 'levels', 'ring', 'wiggle', 'spin', 'beat', 'slide', 'float', 'bounce'] },
        play: { type: 'string', enum: ['hover', 'once', 'loop'] },
      },
      required: ['name'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'list_categories',
    title: 'List categories',
    description: 'List Gota icon categories and how many icons each has.',
    inputSchema: { type: 'object', properties: {} },
    annotations: READ_ONLY,
  },
];

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

function call(name, args) {
  if (name === 'search_icons') {
    if (typeof args.query !== 'string' || !args.query.trim()) return fail('search_icons needs a query: what the icon should mean or show.');
    const limit = Math.min(MAX_RESULTS, Math.max(1, Math.floor(Number(args.limit) || 12)));
    const results = searchIcons(args.query, { limit, category: typeof args.category === 'string' ? args.category : undefined });
    if (!results.length) return text(`No icons match "${args.query}".`);
    return text(results.map((r) => `${r.name} — ${r.label.en ?? ''}${r.label.es ? ` / ${r.label.es}` : ''} (${r.category})`).join('\n'));
  }
  if (name === 'get_icon') {
    if (typeof args.name !== 'string' || !Object.hasOwn(icons, args.name)) {
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
  return text(categories.map((c) => `${c.id} — ${c.label} (${c.icons.length})`).join('\n'));
}

const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

function one(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') return error(msg?.id ?? null, -32600, 'Invalid Request');
  const { id, method, params } = msg;
  if (typeof method !== 'string') return 'result' in msg || 'error' in msg ? null : error(id ?? null, -32600, 'Invalid Request');
  if (id === undefined) return null; // notifications (initialized, cancelled…) need no answer
  if (method === 'initialize') {
    const asked = params?.protocolVersion;
    return reply(id, {
      protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'gota', title: 'Gota', version: VERSION },
      instructions: INSTRUCTIONS,
    });
  }
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return error(id, -32602, `Unknown tool: ${params?.name}`);
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
    try {
      return reply(id, call(tool.name, args));
    } catch (e) {
      // A bad option reaches the model as a tool error it can correct, not as a protocol failure
      return reply(id, fail(e.message));
    }
  }
  return error(id, -32601, `Method not found: ${method}`);
}

/**
 * Answers a parsed JSON-RPC payload: one message or a batch. Returns the response (an array for a
 * batch), or null when there is nothing to answer (notifications and responses). Never throws.
 */
export function handle(payload) {
  if (!Array.isArray(payload)) return one(payload);
  if (!payload.length) return error(null, -32600, 'Invalid Request');
  const answers = payload.map(one).filter(Boolean);
  return answers.length ? answers : null;
}
