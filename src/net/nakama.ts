import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';
import { loadRankProgress, saveRankProgress, type RankProgress } from '../game/ranked';

const DEVICE_KEY = 'bid-rush-nakama-device-v1';
const SESSION_KEY = 'bid-rush-nakama-session-v1';

export type NakamaProfile = {
  userId: string;
  username: string;
  displayName: string;
  progress: RankProgress;
};

let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;
let profile: NakamaProfile | null = null;
let connecting: Promise<Session> | null = null;

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

export function isNakamaConfigured(): boolean {
  // Always "configured" with defaults for local; Vercel should set host.
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

export async function ensureNakamaSession(): Promise<Session> {
  if (session && !session.isexpired((Date.now() / 1000) | 0)) {
    return session;
  }
  if (connecting) return connecting;

  connecting = (async () => {
    const c = getNakamaClient();
    let s = restoreSession();
    if (!s) {
      s = await c.authenticateDevice(deviceId(), true);
    } else {
      try {
        s = await c.sessionRefresh(s);
      } catch {
        s = await c.authenticateDevice(deviceId(), true);
      }
    }
    session = s;
    persistSession(s);

    if (!socket) {
      socket = c.createSocket(useSSL(), false);
    }
    try {
      await socket.connect(s, true);
    } catch {
      // Socket may already be connected after refresh
      try {
        await socket.connect(s, true);
      } catch {
        /* matchmaking needs socket; callers handle errors */
      }
    }

    await syncProfileFromServer();
    return s;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function syncProfileFromServer() {
  // Migrate local progress once if server is empty
  const local = loadRankProgress();
  try {
    await rpc<{ progress: RankProgress; migrated?: boolean }>('migrate_ranked', {
      rankIndex: local.rankIndex,
      rp: local.rp,
    });
  } catch {
    /* offline / server down */
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
  await ensureNakamaSession();
  try {
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
