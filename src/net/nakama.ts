import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';
import { loadRankProgress, saveRankProgress, type RankProgress } from '../game/ranked';

const DEVICE_KEY = 'bid-rush-nakama-device-v1';
const SESSION_KEY = 'bid-rush-nakama-session-v1';
const ACCOUNT_KIND_KEY = 'bid-rush-nakama-account-kind-v1';
const PROFILE_CACHE_KEY = 'bid-rush-nakama-profile-v1';
const LAST_EMAIL_KEY = 'bid-rush-nakama-last-email-v1';

export type NakamaProfile = {
  userId: string;
  username: string;
  displayName: string;
  progress: RankProgress;
};

export type AccountKind = 'email' | 'guest';

export type NakamaConnectionEvent =
  | { kind: 'lost'; reason: string }
  | { kind: 'restored' };

let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;
let profile: NakamaProfile | null = null;
let connecting: Promise<Session> | null = null;
let accountKind: AccountKind | null = null;
let socketOpen = false;
let connectionListener: ((ev: NakamaConnectionEvent) => void) | null = null;
let watchersInstalled = false;
let reconnectTimer = 0;

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

function cacheProfile(p: NakamaProfile | null) {
  try {
    if (!p) localStorage.removeItem(PROFILE_CACHE_KEY);
    else localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function readCachedProfile(): NakamaProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NakamaProfile>;
    if (!parsed.userId || !parsed.username) return null;
    return {
      userId: parsed.userId,
      username: parsed.username,
      displayName: parsed.displayName || parsed.username,
      progress: parsed.progress ?? loadRankProgress(),
    };
  } catch {
    return null;
  }
}

export function loadLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveLastEmail(email: string) {
  try {
    const v = email.trim().toLowerCase();
    if (!v) localStorage.removeItem(LAST_EMAIL_KEY);
    else localStorage.setItem(LAST_EMAIL_KEY, v);
  } catch {
    /* ignore */
  }
}

function isAuthRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: number; message?: string };
  if (anyErr.status === 401 || anyErr.status === 403) return true;
  const msg = (anyErr.message ?? '').toLowerCase();
  return (
    msg.includes('unauthorized') ||
    msg.includes('invalid token') ||
    msg.includes('session expired') ||
    msg.includes('refresh token')
  );
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

export function isNakamaSocketOpen(): boolean {
  return isSocketLive();
}

export function setNakamaConnectionListener(
  fn: ((ev: NakamaConnectionEvent) => void) | null,
) {
  connectionListener = fn;
}

function nowSec(): number {
  return (Date.now() / 1000) | 0;
}

function isSocketLive(): boolean {
  if (!socket || !socketOpen) return false;
  try {
    const adapter = (socket as Socket & { adapter?: { isOpen?: () => boolean } })
      .adapter;
    if (adapter && typeof adapter.isOpen === 'function') {
      return adapter.isOpen();
    }
  } catch {
    /* ignore */
  }
  return socketOpen;
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

/** Restore persisted session if the refresh token is still valid. */
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
    if (s.isrefreshexpired(nowSec())) return null;
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
  if (!socket) {
    socketOpen = false;
    return;
  }
  const s = socket;
  socket = null;
  socketOpen = false;
  try {
    s.ondisconnect = () => {};
    s.onheartbeattimeout = () => {};
    s.onerror = () => {};
    await s.disconnect(false);
  } catch {
    /* ignore */
  }
}

function scheduleReconnect(reason: string) {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = 0;
    void ensureNakamaRealtime()
      .then(() => {
        connectionListener?.({ kind: 'restored' });
      })
      .catch(() => {
        /* listener already got lost; UI can offer refresh */
      });
  }, 400);
  connectionListener?.({ kind: 'lost', reason });
}

function wireSocketLifecycle(s: Socket) {
  s.ondisconnect = () => {
    if (socket !== s) return;
    socketOpen = false;
    scheduleReconnect('Connection lost');
  };
  s.onheartbeattimeout = () => {
    if (socket !== s) return;
    socketOpen = false;
    scheduleReconnect('Connection timed out');
  };
  s.onerror = () => {
    /* close/heartbeat handlers drive recovery */
  };
}

async function connectSocket(s: Session): Promise<void> {
  if (isSocketLive()) return;
  await disconnectSocket();
  const next = getNakamaClient().createSocket(useSSL(), false);
  socket = next;
  wireSocketLifecycle(next);
  try {
    await next.connect(s, true);
    socketOpen = true;
  } catch {
    try {
      await next.connect(s, true);
      socketOpen = true;
    } catch (sockErr) {
      socketOpen = false;
      await disconnectSocket();
      throw new Error(`Socket failed: ${formatNakamaError(sockErr)}`);
    }
  }
}

async function adoptSession(
  s: Session,
  kind: AccountKind,
  opts?: { displayName?: string; publishLeaderboard?: boolean },
): Promise<Session> {
  session = s;
  persistSession(s);
  writeAccountKind(kind);
  await connectSocket(s);
  await syncProfileFromServer({
    displayName: opts?.displayName,
    publishLeaderboard: opts?.publishLeaderboard ?? kind === 'email',
  });
  return s;
}

async function rpc<T>(id: string, payload: Record<string, unknown> = {}): Promise<T> {
  const c = getNakamaClient();
  const s = await ensureNakamaRealtime();
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
  return ensureNakamaRealtime();
}

/** Force a fresh realtime socket (e.g. after a stuck matchmaker ticket). */
export async function reconnectNakamaSocket(): Promise<Session> {
  await disconnectSocket();
  return ensureNakamaRealtime();
}

/**
 * Ensure auth + an open realtime socket (reconnects after tab/network blips).
 */
export async function ensureNakamaRealtime(): Promise<Session> {
  const now = nowSec();
  if (session && !session.isexpired(now) && isSocketLive()) {
    return session;
  }
  if (connecting) return connecting;

  connecting = (async () => {
    const c = getNakamaClient();
    const kind = readAccountKind() ?? 'guest';

    // Refresh access token if we still have a refreshable session in memory
    if (session && !session.isrefreshexpired(now) && session.isexpired(now)) {
      try {
        session = await c.sessionRefresh(session);
        persistSession(session);
      } catch (err) {
        if (isAuthRejection(err)) clearPersistedSession();
      }
    }

    if (session && !session.isexpired(nowSec())) {
      await connectSocket(session);
      return session;
    }

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
        if (s.isexpired(nowSec())) {
          s = await c.sessionRefresh(s);
          persistSession(s);
        }
      } catch (err) {
        if (isAuthRejection(err) || (s && s.isrefreshexpired(nowSec()))) {
          clearPersistedSession();
          if (kind === 'email') {
            writeAccountKind(null);
            throw new Error('Session expired. Please log in again');
          }
          s = await c.authenticateDevice(deviceId(), true);
          return await adoptSession(s, 'guest', { publishLeaderboard: false });
        }
        // Transient network failure — keep tokens; retry socket with existing session
        session = s;
        try {
          await connectSocket(s);
          return s;
        } catch {
          throw err instanceof Error ? err : new Error(formatNakamaError(err));
        }
      }
      return await adoptSession(s, kind, {
        publishLeaderboard: kind === 'email',
      });
    } catch (err) {
      if (kind === 'email') {
        throw err instanceof Error ? err : new Error(formatNakamaError(err));
      }
      if (isAuthRejection(err)) clearPersistedSession();
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

/** Keep the socket alive across tab sleep and network blips. */
export function installNakamaConnectionWatchers(): () => void {
  if (typeof window === 'undefined' || watchersInstalled) {
    return () => {};
  }
  watchersInstalled = true;

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!session && !restoreSession()) return;
    void ensureNakamaRealtime().catch(() => {});
  };
  const onOnline = () => {
    if (!session && !restoreSession()) return;
    void ensureNakamaRealtime().catch(() => {});
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onVisible);

  return () => {
    watchersInstalled = false;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onVisible);
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = 0;
    }
  };
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
  saveLastEmail(email);
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
  saveLastEmail(email);
  await adoptSession(s, 'email', { publishLeaderboard: true });
  if (!profile) throw new Error('Could not load profile after login');
  return { profile, isNewAccount: false };
}

/** Restore a saved email session on boot. Does not create a guest. */
export async function restoreEmailSessionIfAny(): Promise<NakamaProfile | null> {
  if (readAccountKind() !== 'email') return null;
  const existing = restoreSession();
  if (!existing) {
    // Refresh token gone — must re-auth. Keep last email for the form.
    writeAccountKind(null);
    return null;
  }
  session = existing;
  writeAccountKind('email');
  try {
    await ensureNakamaRealtime();
    if (profile) {
      cacheProfile(profile);
      return profile;
    }
    // Socket/RPC flaked but tokens are valid — use cached profile for lobby
    const cached = readCachedProfile();
    if (cached) {
      profile = cached;
      return cached;
    }
    return null;
  } catch (err) {
    if (isAuthRejection(err) || existing.isrefreshexpired(nowSec())) {
      clearPersistedSession();
      writeAccountKind(null);
      profile = null;
      cacheProfile(null);
      return null;
    }
    // Transient outage: stay "logged in" with cached profile if we have one
    const cached = readCachedProfile();
    if (cached) {
      profile = cached;
      return cached;
    }
    return null;
  }
}

export async function logOutAccount(): Promise<void> {
  await disconnectSocket();
  clearPersistedSession();
  writeAccountKind(null);
  profile = null;
  cacheProfile(null);
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
    cacheProfile(p);
    if (p.progress) saveRankProgress(p.progress);
  } catch {
    if (!profile) profile = readCachedProfile();
  }
}

export async function refreshNakamaProfile(): Promise<NakamaProfile | null> {
  try {
    await ensureNakamaRealtime();
    const p = await rpc<NakamaProfile>('get_profile');
    profile = p;
    cacheProfile(p);
    if (p.progress) saveRankProgress(p.progress);
    return p;
  } catch {
    return profile;
  }
}

export async function setNakamaDisplayName(displayName: string): Promise<string> {
  await ensureNakamaRealtime();
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
  avatar?: string;
}): Promise<ApplyRankedServerResult | null> {
  try {
    await ensureNakamaRealtime();
    const res = await rpc<ApplyRankedServerResult>('apply_ranked', {
      won: input.won,
      coins: input.coins,
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
    await ensureNakamaRealtime();
    // Refresh this account's board row so nickname stays current
    if (isEmailAccount()) {
      try {
        await rpc('ensure_leaderboard', {
          displayName: profile?.displayName || undefined,
        });
      } catch {
        /* ignore */
      }
    }
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
