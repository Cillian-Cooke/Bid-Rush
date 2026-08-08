#!/usr/bin/env node
/**
 * Build Nakama runtime: esbuild bundles logic, then wraps with top-level
 * function declarations Nakama's goja runtime can register by name.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'build', 'index.js');

await esbuild.build({
  entryPoints: [path.join(root, 'src', 'index.ts')],
  bundle: true,
  outfile: path.join(root, 'build', 'bundle.iife.js'),
  target: 'es2020',
  format: 'iife',
  globalName: '__bidRushHandlers',
  logLevel: 'info',
});

const bundle = fs.readFileSync(
  path.join(root, 'build', 'bundle.iife.js'),
  'utf8',
);

const wrapper = `${bundle}
// Top-level named functions required by Nakama JS runtime registration.
function get_profile(ctx, logger, nk, payload) {
  return __bidRushHandlers.get_profile(ctx, logger, nk, payload);
}
function set_display_name(ctx, logger, nk, payload) {
  return __bidRushHandlers.set_display_name(ctx, logger, nk, payload);
}
function get_ranked(ctx, logger, nk, payload) {
  return __bidRushHandlers.get_ranked(ctx, logger, nk, payload);
}
function migrate_ranked(ctx, logger, nk, payload) {
  return __bidRushHandlers.migrate_ranked(ctx, logger, nk, payload);
}
function ensure_leaderboard(ctx, logger, nk, payload) {
  return __bidRushHandlers.ensure_leaderboard(ctx, logger, nk, payload);
}
function apply_ranked(ctx, logger, nk, payload) {
  return __bidRushHandlers.apply_ranked(ctx, logger, nk, payload);
}
function list_leaderboard(ctx, logger, nk, payload) {
  return __bidRushHandlers.list_leaderboard(ctx, logger, nk, payload);
}
function create_custom_match(ctx, logger, nk, payload) {
  return __bidRushHandlers.create_custom_match(ctx, logger, nk, payload);
}
function join_custom_match(ctx, logger, nk, payload) {
  return __bidRushHandlers.join_custom_match(ctx, logger, nk, payload);
}
function matchInit(ctx, logger, nk, params) {
  return __bidRushHandlers.matchInit(ctx, logger, nk, params);
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  return __bidRushHandlers.matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata);
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  return __bidRushHandlers.matchJoin(ctx, logger, nk, dispatcher, tick, state, presences);
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  return __bidRushHandlers.matchLeave(ctx, logger, nk, dispatcher, tick, state, presences);
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  return __bidRushHandlers.matchLoop(ctx, logger, nk, dispatcher, tick, state, messages);
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return __bidRushHandlers.matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds);
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return __bidRushHandlers.matchSignal(ctx, logger, nk, dispatcher, tick, state, data);
}
function matchmakerMatched(ctx, logger, nk, entries) {
  return __bidRushHandlers.matchmakerMatched(ctx, logger, nk, entries);
}
function InitModule(ctx, logger, nk, initializer) {
  __bidRushHandlers.setupLeaderboard(nk, logger);
  initializer.registerRpc('get_profile', get_profile);
  initializer.registerRpc('set_display_name', set_display_name);
  initializer.registerRpc('get_ranked', get_ranked);
  initializer.registerRpc('migrate_ranked', migrate_ranked);
  initializer.registerRpc('ensure_leaderboard', ensure_leaderboard);
  initializer.registerRpc('apply_ranked', apply_ranked);
  initializer.registerRpc('list_leaderboard', list_leaderboard);
  initializer.registerRpc('create_custom_match', create_custom_match);
  initializer.registerRpc('join_custom_match', join_custom_match);
  initializer.registerMatch('bid_rush', {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });
  initializer.registerMatchmakerMatched(matchmakerMatched);
  logger.info('Bid Rush Nakama runtime loaded (full authority).');
}
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, wrapper);
console.log('wrote', outFile, `(${(wrapper.length / 1024).toFixed(1)}kb)`);
