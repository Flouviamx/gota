#!/usr/bin/env node
// Gota · MCP server over stdio, for AI agents on this computer (Claude Code, Cursor, Claude Desktop…):
// one JSON-RPC message per line on stdin, its answer on stdout. The tools and the protocol are in
// ./handler.mjs, shared with the remote server (api/mcp.mjs). Run `node scripts/build.mjs` first.
import { createInterface } from 'node:readline';
import { handle, PARSE_ERROR } from './handler.mjs';

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return send(PARSE_ERROR);
  }
  const answer = handle(payload);
  if (answer) send(answer);
});
