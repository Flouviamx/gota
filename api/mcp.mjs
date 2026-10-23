// Gota · the remote MCP server at gota.flouvia.com/mcp (a Vercel function; vercel.json routes /mcp here).
// MCP's Streamable HTTP transport, stateless: each POST carries JSON-RPC messages and gets their answers
// back as JSON, so there are no sessions and no event stream (GET and DELETE answer 405). Public and
// read-only, with no credentials: any origin may call it. The tools and the protocol are in
// mcp/handler.mjs, shared with the stdio server.
import { handle, PARSE_ERROR, PROTOCOL_VERSIONS } from '../mcp/handler.mjs';

const MAX_BODY = 64 * 1024;
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'Content-Type': 'application/json', ...extra } });
const refuse = (status, message, extra) => json({ jsonrpc: '2.0', id: null, error: { code: -32600, message } }, status, extra);

export async function POST(request) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return refuse(415, 'Content-Type must be application/json');
  // After initialize, clients name the version they agreed on; an unknown one can't have come from it
  const version = request.headers.get('mcp-protocol-version');
  if (version && !PROTOCOL_VERSIONS.includes(version)) return refuse(400, `Unsupported MCP-Protocol-Version: ${version}`);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return refuse(413, 'Request too large');
  const body = await request.text();
  if (body.length > MAX_BODY) return refuse(413, 'Request too large');
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json(PARSE_ERROR, 400);
  }
  const answer = handle(payload);
  return answer ? json(answer) : new Response(null, { status: 202, headers: HEADERS });
}

const notAllowed = () => refuse(405, 'Gota’s MCP server takes JSON-RPC messages by POST; it keeps no sessions and no event stream.', { Allow: 'POST, OPTIONS' });
export const GET = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });
