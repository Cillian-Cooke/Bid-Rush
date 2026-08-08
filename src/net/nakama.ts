import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';
import { loadRankProgress, saveRankProgress, type RankProgress } from '../game/ranked';

const DEVICE_KEY = 'bid-rush-nakama-device-v1';
const SESSION_KEY = 'bid-rush-nakama-session-v1';
const ACCOUNT_KIND_KEY = 'bid-rush-nakama-account-kind-v1';

export type NakamaProfile = {
  userId: string;
  username: string;
  displayName: string;
  progress: RankProgress;
};

export type AccountKind = 'email' | 'guest';

let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;
let profile: NakamaProfile | null = null;
let connecting: Promise<Session> | null = null;
let accountKind: AccountKind | null = null;

function host(): string {
  return import.meta.env.VITE_NAKAMA_HOST ?? '127.0.0.1';
}

function port(): string {
  return String(import.meta.env.VITE_NAKAMA_PORT ?? '7350');
}

function serverKey(): string {
  return import.meta.env.VITE_NAKAMA_SERVER_KEY ?? 'defaultkey';
}

function useSSL(): boolean {
  const v = import.meta.env.VITE_NAKAMA_USE_SSL;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

export function nakamaEndpointLabel(): string {
  return `${host()}:${port()}${useSSL() ? ' (ssl)' : ''}`;
}

function formatNakamaError(err: unknown): string {
  const where = nakamaEndpointLabel();
  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      status?: number;
      statusText?: string;
    };
    const msg =
      typeof anyErr.message === 'string' && anyErr.message
        ? anyErr.message
        : anyErr.statusText || 'Nakama request failed';
    return `${msg} @ ${where}`;
  }
  if (err instanceof Error && err.message) return `${err.message} @ ${where}`;
  return `Nakama unavailable @ ${where}`;
}

function readAccountKind(): AccountKind | null {
  try {
    const v = localStorage.getItem(ACCOUNT_KIND_KEY);
    if (v === 'email' || v === 'guest') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeAccountKind(kind: AccountKind | null) {
  accountKind = kind;
  try {
    if (!kind) localStorage.removeItem(ACCOUNT_KIND_KEY);
    else localStorage.setItem(ACCOUNT_KIND_KEY, kind);
  } catch {
    /* ignore */
  }
}

function clearPersistedSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  session = null;
}

export function getNakamaClient(): Client {
  if (!client) {
    client = new Client(serverKey(), host(), port(), useSSL());
  }
  return client;
}

export function getNakamaSession(): Session | null {
  return session;
}

export function getNakamaSocket(): Socket | null {
  return socket;
}

export function getNakamaProfile(): NakamaProfile | null {
  return profile;
}

export function getAccountKind(): AccountKind | null {
  return accountKind ?? readAccountKind();
}

export function isEmailAccount(): boolean {
  return getAccountKind() === 'email';
}

export function isNakamaConfigured(): boolean {
  return true;
}

function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

function restoreSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      token: string;
      refresh_token: string;
    };
    if (!parsed.token || !parsed.refresh_token) return null;
    const s = Session.restore(parsed.token, parsed.refresh_token);
    if (s.isexpired((Date.now() / 1000) | 0)) return null;
    return s;
  } catch {
    return null;
  }
}

function persistSession(s: Session) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: s.token,
        refresh_token: s.refresh_token,
      }),
    );
  } catch {
    /* ignore */
  }
}

async function disconnectSocket() {
  if (!socket) return;
  try {
    await socket.disconnect(false);
  } catch {
    /* ignore */
  }
  socket = null;
}

async function adoptSession(
  s: Session,
  kind: AccountKind,
  opts?: { displayName?: string; publishLeaderboard?: boolean },
): Promise<Session> {
  session = s;
  persistSession(s);
  writeAccountKind(kind);

  if (!socket) {
    socket = getNakamaClient().createSocket(useSSL(), false);
  }
  try {
    await socket.connect(s, true);
  } catch {
    try {
      await socket.connect(s, true);
    } catch (sockErr) {
      throw new Error(`Socket failed: ${formatNakamaError(sockErr)}`);
    }
  }

  await syncProfileFromServer({
    displayName: opts?.displayName,
    publishLeaderboard: opts?.publishLeaderboard ?? kind === 'email',
  });
  return s;
}

async function rpc<T>(id: string, payload: Record<string, unknown> = {}): Promise<T> {
  const c = getNakamaClient();
  const s = await ensureNakamaSession();
  const res = await c.rpc(s, id, payload);
  if (res.payload == null) return {} as T;
  return res.payload as T;
}

/** Public RPC helper used by onlineSession / lobby. */
export async function rpcJson<T>(
  id: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return rpc<T>(id, payload);
}

/**
 * Ensure a Nakama session. Restores email/guest sessions; otherwise creates a
 * guest device session (local play / soft online). Email accounts use signup/login.
 */
export async function ensureNakamaSession(): Promise<Session> {
  if (session && !session.isexpired((Date.now() / 1000) | 0)) {
    return session;
  }
  if (connecting) return connecting;

  connecting = (async () => {
    const c = getNakamaClient();
    const kind = readAccountKind() ?? 'guest';
    let s = restoreSession();
    try {
      if (!s) {
        if (kind === 'email') {
          throw new Error('Please log in to your account');
        }
        s = await c.authenticateDevice(deviceId(), true);
        return await adoptSession(s, 'guest', { publishLeaderboard: false });
      }
      try {
        s = await c.sessionRefresh(s);
      } catch {
        clearPersistedSession();
        if (kind === 'email') {
          throw new Error('Session expired — please log in again');
        }
        s = await c.authenticateDevice(deviceId(), true);
        return await adoptSession(s, 'guest', { publishLeaderboard: false });
      }
      return await adoptSession(s, kind, {
        publishLeaderboard: kind === 'email',
      });
    } catch (err) {
      if (kind === 'email') {
        throw err instanceof Error ? err : new Error(formatNakamaError(err));
      }
      clearPersistedSession();
      try {
        const guest = await c.authenticateDevice(deviceId(), true);
        return await adoptSession(guest, 'guest', { publishLeaderboard: false });
      } catch (retryErr) {
        throw new Error(formatNakamaError(retryErr ?? err));
      }
    }
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 18);
  if (cleaned.length >= 3) return cleaned;
  return `player_${Math.random().toString(36).slice(2, 8)}`;
}

export type AuthResult = {
  profile: NakamaProfile;
  /** True when this browser just created the account (signup). */
  isNewAccount: boolean;
};

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const displayName = input.displayName.trim().slice(0, 24);
  if (!email.includes('@')) throw new Error('Enter a valid email');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  if (!displayName) throw new Error('Enter a display name');

  await disconnectSocket();
  clearPersistedSession();
  profile = null;

  const username = sanitizeUsername(displayName);
  const c = getNakamaClient();
  let s: Session;
  try {
    s = await c.authenticateEmail(email, password, true, username);
  } catch (err) {
    throw new Error(formatNakamaError(err));
  }
  await adoptSession(s, 'email', {
    displayName,
    publishLeaderboard: true,
  });
  if (!profile) throw new Error('Could not load profile after sign up');
  return { profile, isNewAccount: true };
}

export async function logInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email.includes('@')) throw new Error('Enter a valid email');
  if (!password) throw new Error('Enter your password');

  await disconnectSocket();
  clearPersistedSession();
  profile = null;

  const c = getNakamaClient();
  let s: Session;
  try {
    s = await c.authenticateEmail(email, password, false);
  } catch (err) {
    throw new Error(formatNakamaError(err));
  }
  await adoptSession(s, 'email', { publishLeaderboard: true });
  if (!profile) throw new Error('Could not load profile after login');
  return { profile, isNewAccount: false };
}

/** Restore a saved email session on boot. Does not create a guest. */
export async function restoreEmailSessionIfAny(): Promise<NakamaProfile | null> {
  if (readAccountKind() !== 'email') return null;
  const existing = restoreSession();
  if (!existing) {
    writeAccountKind(null);
    return null;
  }
  try {
    await ensureNakamaSession();
    if (!isEmailAccount() || !profile) return null;
    return profile;
  } catch {
    clearPersistedSession();
    writeAccountKind(null);
    profile = null;
    return null;
  }
}

export async function logOutAccount(): Promise<void> {
  await disconnectSocket();
  clearPersistedSession();
  writeAccountKind(null);
  profile = null;
}

async function syncProfileFromServer(opts?: {
  displayName?: string;
  publishLeaderboard?: boolean;
}) {
  const local = loadRankProgress();
  try {
    await rpc<{ progress: RankProgress; migrated?: boolean }>('migrate_ranked', {
      rankIndex: local.rankIndex,
      rp: local.rp,
    });
  } catch {
    /* offline / server down */
  }

  if (opts?.displayName) {
    try {
      await rpc<{ displayName: string }>('set_display_name', {
        displayName: opts.displayName,
      });
    } catch {
      /* ignore */
    }
  }

  if (opts?.publishLeaderboard) {
    try {
      await rpc('ensure_leaderboard', {
        displayName: opts.displayName || undefined,
      });
    } catch {
      /* ignore */
    }
  }

  try {
    const p = await rpc<NakamaProfile>('get_profile');
    profile = p;
    if (p.progress) saveRankProgress(p.progress);
  } catch {
    profile = null;
  }
}

export async function refreshNakamaProfile(): Promise<NakamaProfile | null> {
  try {
    await ensureNakamaSession();
    const p = await rpc<NakamaProfile>('get_profile');
    profile = p;
    if (p.progress) saveRankProgress(p.progress);
    return p;
  } catch {
    return profile;
  }
}

export async function setNakamaDisplayName(displayName: string): Promise<string> {
  await ensureNakamaSession();
  const res = await rpc<{ displayName: string }>('set_display_name', {
    displayName,
  });
  if (profile) profile = { ...profile, displayName: res.displayName };
  if (isEmailAccount()) {
    try {
      await rpc('ensure_leaderboard', { displayName: res.displayName });
    } catch {
      /* ignore */
    }
  }
  return res.displayName;
}

export type ApplyRankedServerResult = {
  progress: RankProgress;
  delta: number;
  promoted: boolean;
  demoted: boolean;
  prevRankIndex: number;
};

export async function applyRankedOnServer(input: {
  won: boolean;
  coins?: number;
  name?: string;
  avatar?: string;
}): Promise<ApplyRankedServerResult | null> {
  try {
    await ensureNakamaSession();
    const res = await rpc<ApplyRankedServerResult>('apply_ranked', {
      won: input.won,
      coins: input.coins,
      name: input.name,
      avatar: input.avatar,
    });
    if (res.progress) saveRankProgress(res.progress);
    if (profile) profile = { ...profile, progress: res.progress };
    return res;
  } catch {
    return null;
  }
}

export type LeaderboardRow = {
  ownerId: string;
  username: string;
  score: number;
  subscore: number;
  rank?: number;
  metadata: { name?: string; avatar?: string; won?: boolean };
};

export async function fetchNakamaLeaderboard(
  limit = 20,
): Promise<LeaderboardRow[]> {
  try {
    await ensureNakamaSession();
    const res = await rpc<{ records: LeaderboardRow[] }>('list_leaderboard', {
      limit,
    });
    return res.records ?? [];
  } catch {
    return [];
  }
}

export function displayNameForOnline(): string {
  return (
    profile?.displayName ||
    profile?.username ||
    'Player'
  ).slice(0, 24);
}

export function scoreToRankLabel(score: number): string {
  const rankIndex = Math.max(0, Math.min(4, Math.floor(score / 1000)));
  const rp = score % 1000;
  return `R${rankIndex + 1} · ${rp} RP`;
}
