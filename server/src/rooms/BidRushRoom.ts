import { Room, CloseCode, type Client } from 'colyseus';
import { decideBotAction, nextBotCooldown } from '../../../src/game/bots.ts';
import {
  CONFIG,
  HANDLE_POOL,
  MODE_SETUP,
  PLAYER_COLORS,
} from '../../../src/game/constants.ts';
import {
  applyUseItem,
  bid,
  createInitialState,
  createRng,
  reorderHand,
  sellItem,
  tick,
} from '../../../src/game/engine.ts';
import { pickMatchPool } from '../../../src/game/items.ts';
import {
  CUSTOM_DEFAULTS,
  resolveCustomPool,
  type CustomMatchSettings,
} from '../../../src/game/customSettings.ts';
import {
  bidOnNameTag,
  tickNameAuction,
} from '../../../src/game/naming.ts';
import type {
  BotArchetype,
  DifficultyMode,
  GameMode,
  GameState,
  NameAuctionState,
  NameTag,
  PlayerIdentity,
  UseTargets,
} from '../../../src/game/types.ts';
import type { ClientMessages, CreateOptions } from '../../../src/net/protocol.ts';
import { RoomState, Seat } from '../schema/RoomState.ts';

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function assignArchetypes(
  botCount: number,
  difficulty: DifficultyMode,
  rng: () => number,
): BotArchetype[] {
  if (difficulty !== 'mixed') {
    return Array.from({ length: botCount }, () => difficulty);
  }
  const pool: BotArchetype[] = ['chill', 'balanced', 'ruthless'];
  return Array.from(
    { length: botCount },
    () => pool[Math.floor(rng() * pool.length)]!,
  );
}

export class BidRushRoom extends Room {
  state = new RoomState();

  private rng: () => number = Math.random;
  private seed = 0;
  private naming: NameAuctionState | null = null;
  private game: GameState | null = null;
  private matchPool: import('../../../src/game/types.ts').ItemId[] | null =
    null;
  private poolRevealEndsAt: number | null = null;
  private goAt: number | null = null;
  private custom: CustomMatchSettings = {
    ...CUSTOM_DEFAULTS,
    itemIds: [...CUSTOM_DEFAULTS.itemIds],
  };

  onCreate(options: CreateOptions = {}) {
    const mode: GameMode =
      options.mode === 'duel' || options.mode === 'blitz'
        ? options.mode
        : 'blitz';
    const difficulty: DifficultyMode =
      options.difficulty === 'chill' ||
      options.difficulty === 'balanced' ||
      options.difficulty === 'ruthless' ||
      options.difficulty === 'mixed'
        ? options.difficulty
        : 'mixed';

    this.custom = this.mergeCustom(options.custom);

    this.state.mode = mode;
    this.state.difficulty = difficulty;
    this.state.phase = 'lobby';
    this.state.roomCode = this.roomId;
    this.maxClients = MODE_SETUP[mode].players;
    this.setMetadata({ roomCode: this.roomId, mode });

    this.onMessage('set_options', (client, message: ClientMessages['set_options']) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'lobby') return;
      if (message.mode === 'duel' || message.mode === 'blitz') {
        this.state.mode = message.mode;
        this.maxClients = MODE_SETUP[message.mode].players;
        this.setMetadata({ roomCode: this.roomId, mode: message.mode });
        this.trimSeatsToMax();
      }
      if (
        message.difficulty === 'chill' ||
        message.difficulty === 'balanced' ||
        message.difficulty === 'ruthless' ||
        message.difficulty === 'mixed'
      ) {
        this.state.difficulty = message.difficulty;
      }
      if (message.custom) {
        this.custom = this.mergeCustom(message.custom);
      }
    });

    this.onMessage('set_ready', (client, message: ClientMessages['set_ready']) => {
      const seat = this.state.seats.get(client.sessionId);
      if (!seat || this.state.phase !== 'lobby') return;
      seat.ready = !!message.ready;
    });

    this.onMessage('start', (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'lobby') return;
      this.beginNaming();
    });

    this.onMessage('bid_name', (client, message: ClientMessages['bid_name']) => {
      if (!this.naming || this.state.phase !== 'naming') return;
      const seat = this.state.seats.get(client.sessionId);
      if (!seat?.bidderId || !message?.tagId) return;
      this.naming = bidOnNameTag(this.naming, seat.bidderId, message.tagId);
      this.broadcastNaming();
    });

    this.onMessage('bid', (client, message: ClientMessages['bid']) => {
      if (!this.game || this.state.phase !== 'playing') return;
      const seat = this.state.seats.get(client.sessionId);
      if (!seat?.playerId || typeof message?.tileIndex !== 'number') return;
      const player = this.game.players.find((p) => p.id === seat.playerId);
      if (!player?.isAlive) return;
      this.game = bid(this.game, seat.playerId, message.tileIndex);
      this.broadcastGame();
    });

    this.onMessage('sell', (client, message: ClientMessages['sell']) => {
      if (!this.game || this.state.phase !== 'playing') return;
      const seat = this.state.seats.get(client.sessionId);
      if (!seat?.playerId || !message?.instanceId) return;
      const player = this.game.players.find((p) => p.id === seat.playerId);
      if (!player?.isAlive) return;
      this.game = sellItem(
        this.game,
        seat.playerId,
        message.instanceId,
        this.rng,
      );
      this.broadcastGame();
    });

    this.onMessage('use', (client, message: ClientMessages['use']) => {
      if (!this.game || this.state.phase !== 'playing') return;
      const seat = this.state.seats.get(client.sessionId);
      if (!seat?.playerId || !message?.instanceId) return;
      const player = this.game.players.find((p) => p.id === seat.playerId);
      if (!player?.isAlive) return;
      const targets: UseTargets = message.targets ?? {};
      this.game = applyUseItem(
        this.game,
        seat.playerId,
        message.instanceId,
        targets,
        this.rng,
      );
      this.broadcastGame();
    });

    this.onMessage(
      'reorder_hand',
      (client, message: ClientMessages['reorder_hand']) => {
        if (!this.game || this.state.phase !== 'playing') return;
        const seat = this.state.seats.get(client.sessionId);
        if (
          !seat?.playerId ||
          typeof message?.fromIndex !== 'number' ||
          typeof message?.toIndex !== 'number'
        ) {
          return;
        }
        this.game = reorderHand(
          this.game,
          seat.playerId,
          message.fromIndex,
          message.toIndex,
        );
        this.broadcastGame();
      },
    );

    this.setSimulationInterval((deltaTime) => this.simTick(deltaTime));
  }

  onJoin(client: Client, options: CreateOptions = {}) {
    if (this.state.phase !== 'lobby') {
      throw new Error('Match already started');
    }
    if (this.state.seats.size >= this.maxClients) {
      throw new Error('Room is full');
    }

    const seatIndex = this.nextSeatIndex();
    const seat = new Seat();
    seat.sessionId = client.sessionId;
    seat.displayName =
      typeof options.displayName === 'string' && options.displayName.trim()
        ? options.displayName.trim().slice(0, 24)
        : `Player ${seatIndex + 1}`;
    seat.ready = false;
    seat.color = PLAYER_COLORS[seatIndex % PLAYER_COLORS.length]!;
    seat.connected = true;
    seat.seatIndex = seatIndex;
    this.state.seats.set(client.sessionId, seat);

    if (!this.state.hostSessionId) {
      this.state.hostSessionId = client.sessionId;
    }

    client.send('you', {
      sessionId: client.sessionId,
      playerId: '',
      bidderId: '',
    });
  }

  async onLeave(client: Client, code?: number) {
    const seat = this.state.seats.get(client.sessionId);
    if (!seat) return;

    const consented = code === CloseCode.CONSENTED;

    if (this.state.phase === 'lobby') {
      this.state.seats.delete(client.sessionId);
      if (this.state.hostSessionId === client.sessionId) {
        const next = [...this.state.seats.keys()][0];
        this.state.hostSessionId = next ?? '';
      }
      return;
    }

    seat.connected = false;
    try {
      if (!consented) {
        await this.allowReconnection(client, 15);
        seat.connected = true;
        return;
      }
    } catch {
      // timed out or unavailable
    }

    this.takeOverSeatAsBot(seat);
  }

  private nextSeatIndex(): number {
    const used = new Set(
      [...this.state.seats.values()].map((s) => s.seatIndex),
    );
    let i = 0;
    while (used.has(i)) i += 1;
    return i;
  }

  private trimSeatsToMax() {
    const max = this.maxClients;
    const ordered = [...this.state.seats.values()].sort(
      (a, b) => a.seatIndex - b.seatIndex,
    );
    for (const seat of ordered) {
      if (seat.seatIndex < max) continue;
      const client = this.clients.find((c) => c.sessionId === seat.sessionId);
      this.state.seats.delete(seat.sessionId);
      client?.leave(CloseCode.WITH_ERROR);
    }
  }

  private beginNaming() {
    const mode = this.state.mode as GameMode;
    const difficulty = this.state.difficulty as DifficultyMode;
    const setup = MODE_SETUP[mode];
    this.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.rng = createRng(this.seed);

    const poolRng = createRng(this.seed ^ 0x51ceed);
    const customPool = resolveCustomPool(this.custom);
    this.matchPool =
      customPool.length > 0 ? customPool : pickMatchPool(poolRng);

    const tags: NameTag[] = shuffle(HANDLE_POOL, this.rng)
      .slice(0, setup.gridSize)
      .map((h, i) => ({
        id: `tag_${i}`,
        name: h.name,
        avatar: h.avatar,
        price: 0,
        highBidderId: null,
      }));

    // Fill seats: connected humans first by seatIndex, then bots
    const humans = [...this.state.seats.values()].sort(
      (a, b) => a.seatIndex - b.seatIndex,
    );
    const botCount = Math.max(0, setup.players - humans.length);
    const archetypes = assignArchetypes(botCount, difficulty, this.rng);

    // Re-index seats 0..humans-1 for stable player_N mapping
    humans.forEach((seat, i) => {
      seat.seatIndex = i;
      seat.bidderId = `bidder_${i}`;
      seat.playerId = `player_${i}`;
      seat.ready = true;
    });

    const participants = Array.from({ length: setup.players }, (_, i) => {
      const human = humans[i];
      return {
        id: `bidder_${i}`,
        isHuman: !!human,
        color: human?.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length]!,
        cooldownMs: human ? 0 : 150 + Math.floor(this.rng() * 400),
      };
    });

    this.naming = {
      mode,
      difficulty,
      tags,
      participants,
      humanId: humans[0]?.bidderId ?? 'bidder_0',
      msLeft: CONFIG.NAME_AUCTION_MS,
      seed: this.seed,
    };

    // Stash bot archetypes on room for resolve
    (this as unknown as { _botArchetypes: BotArchetype[] })._botArchetypes =
      archetypes;

    this.state.phase = 'naming';
    this.broadcastNaming();
    this.sendYouToAll();
  }

  private resolveIdentities(): PlayerIdentity[] {
    const naming = this.naming!;
    const setup = MODE_SETUP[naming.mode];
    const archetypes =
      (this as unknown as { _botArchetypes?: BotArchetype[] })._botArchetypes ??
      assignArchetypes(setup.botCount, naming.difficulty, this.rng);

    const claimed = new Map<string, NameTag>();
    const takenTagIds = new Set<string>();
    for (const tag of naming.tags) {
      if (tag.highBidderId && !claimed.has(tag.highBidderId)) {
        claimed.set(tag.highBidderId, tag);
        takenTagIds.add(tag.id);
      }
    }
    const leftovers = shuffle(
      naming.tags.filter((t) => !takenTagIds.has(t.id)),
      this.rng,
    );

    const identities: PlayerIdentity[] = [];
    let botArchIdx = 0;
    for (const p of naming.participants) {
      let tag = claimed.get(p.id);
      if (!tag) tag = leftovers.shift();
      if (!tag) {
        tag = {
          id: 'fallback',
          name: p.isHuman ? 'You' : `Bidder ${p.id}`,
          avatar: '❓',
          price: 0,
          highBidderId: null,
        };
      }
      identities.push({
        name: tag.name,
        avatar: tag.avatar,
        color: p.color,
        isHuman: p.isHuman,
        archetype: p.isHuman ? null : archetypes[botArchIdx++] ?? 'balanced',
      });
    }
    return identities;
  }

  private finishNaming() {
    if (!this.naming) return;
    const identities = this.resolveIdentities();
    this.game = createInitialState(
      {
        mode: this.naming.mode,
        difficulty: this.naming.difficulty,
        identities,
        rules: {
          gameLengthMs: this.custom.gameLengthMs,
          speedMult: this.custom.speedMult,
          startCoins: this.custom.startCoins,
          tileTimerMs: this.custom.tileTimerMs,
        },
      },
      this.naming.seed,
      this.matchPool ?? undefined,
    );
    // humanId is first human — clients remap to their own playerId
    this.naming = null;
    this.state.phase = 'countdown';
    this.poolRevealEndsAt = Date.now() + CONFIG.POOL_REVEAL_MS;
    this.goAt = null;
    this.state.countdown = Math.ceil(CONFIG.POOL_REVEAL_MS / 1000);
    this.broadcastGame();
  }

  private beginPlaying() {
    this.state.phase = 'playing';
    this.state.countdown = 0;
    this.poolRevealEndsAt = null;
    this.goAt = null;
    this.broadcastGame();
  }

  private takeOverSeatAsBot(seat: Seat) {
    if (!this.game || !seat.playerId) return;
    const arch: BotArchetype =
      (this.state.difficulty as DifficultyMode) === 'mixed'
        ? 'balanced'
        : ((this.state.difficulty as BotArchetype) ?? 'balanced');
    this.game = {
      ...this.game,
      players: this.game.players.map((p) =>
        p.id === seat.playerId
          ? {
              ...p,
              isHuman: false,
              archetype: arch,
              botCooldownMs: 200 + Math.floor(this.rng() * 400),
            }
          : p,
      ),
    };
    this.broadcastGame();
  }

  private applyBotIntents(game: GameState): GameState {
    let state = game;
    for (const player of state.players) {
      if (!player.isAlive || player.isHuman) continue;
      if (player.botCooldownMs > 0) continue;
      if (player.handcuffMs > 0) {
        const arch = player.archetype ?? 'balanced';
        state = {
          ...state,
          players: state.players.map((p) =>
            p.id === player.id
              ? { ...p, botCooldownMs: nextBotCooldown(arch, this.rng) }
              : p,
          ),
        };
        continue;
      }

      const intent = decideBotAction(state, player.id, this.rng);
      const arch = player.archetype ?? 'balanced';
      const cooldown = nextBotCooldown(arch, this.rng);

      if (!intent) {
        state = {
          ...state,
          players: state.players.map((p) =>
            p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
          ),
        };
        continue;
      }

      if (intent.kind === 'bid') {
        state = bid(state, player.id, intent.tileIndex);
      } else if (intent.kind === 'sell') {
        state = sellItem(state, player.id, intent.instanceId, this.rng);
      } else if (intent.kind === 'use') {
        state = applyUseItem(
          state,
          player.id,
          intent.instanceId,
          intent.targets,
          this.rng,
        );
      } else if (intent.kind === 'reorder') {
        state = reorderHand(
          state,
          player.id,
          intent.fromIndex,
          intent.toIndex,
        );
      }

      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
        ),
      };
    }
    return state;
  }

  private simTick(deltaTime: number) {
    const dt = Math.min(250, Math.max(0, deltaTime || CONFIG.TICK_MS));

    if (this.state.phase === 'naming' && this.naming) {
      this.naming = tickNameAuction(this.naming, dt, this.rng);
      if (this.naming.msLeft <= 0) {
        this.finishNaming();
        return;
      }
      // Broadcast naming ~10 Hz to save bandwidth
      if (Math.floor(this.naming.msLeft / 100) !== Math.floor((this.naming.msLeft + dt) / 100)) {
        this.broadcastNaming();
      } else {
        this.broadcastNaming();
      }
      return;
    }

    if (this.state.phase === 'countdown') {
      const now = Date.now();
      if (this.goAt != null) {
        if (now >= this.goAt) this.beginPlaying();
        return;
      }
      if (this.poolRevealEndsAt == null) {
        this.beginPlaying();
        return;
      }
      const remain = this.poolRevealEndsAt - now;
      if (remain <= 0) {
        this.state.countdown = 0;
        this.goAt = now + 450;
        return;
      }
      this.state.countdown = Math.max(1, Math.ceil(remain / 1000));
      return;
    }

    if (this.state.phase === 'playing' && this.game) {
      let next = this.applyBotIntents(this.game);
      next = tick(next, dt, this.rng);
      this.game = next;
      this.broadcastGame();
      if (next.ended) {
        this.state.phase = 'results';
        this.broadcast('match_ended', { winnerId: next.winnerId });
      }
    }
  }

  private broadcastNaming() {
    if (!this.naming) return;
    this.broadcast('naming', this.naming);
  }

  private broadcastGame() {
    if (!this.game) return;
    // Send snapshot; clear events after so next patch is delta of new events only
    const snap: GameState = {
      ...this.game,
      events: [...this.game.events],
    };
    this.broadcast('game', snap);
    this.game = { ...this.game, events: [] };
  }

  private sendYouToAll() {
    for (const client of this.clients) {
      const seat = this.state.seats.get(client.sessionId);
      if (!seat) continue;
      client.send('you', {
        sessionId: client.sessionId,
        playerId: seat.playerId,
        bidderId: seat.bidderId,
      });
    }
  }

  private mergeCustom(
    partial?: CreateOptions['custom'],
  ): CustomMatchSettings {
    const base: CustomMatchSettings = {
      ...CUSTOM_DEFAULTS,
      itemIds: [...CUSTOM_DEFAULTS.itemIds],
      ...this.custom,
    };
    if (!partial) return base;
    return {
      itemIds:
        Array.isArray(partial.itemIds) && partial.itemIds.length > 0
          ? partial.itemIds
          : base.itemIds,
      gameLengthMs:
        typeof partial.gameLengthMs === 'number'
          ? partial.gameLengthMs
          : base.gameLengthMs,
      speedMult:
        typeof partial.speedMult === 'number'
          ? partial.speedMult
          : base.speedMult,
      startCoins:
        typeof partial.startCoins === 'number'
          ? partial.startCoins
          : base.startCoins,
      tileTimerMs:
        typeof partial.tileTimerMs === 'number'
          ? partial.tileTimerMs
          : base.tileTimerMs,
    };
  }
}
