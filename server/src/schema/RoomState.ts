import { Schema, type, MapSchema } from '@colyseus/schema';

export class Seat extends Schema {
  @type('string') sessionId: string = '';
  @type('string') displayName: string = '';
  @type('boolean') ready: boolean = false;
  @type('string') color: string = '';
  @type('boolean') connected: boolean = true;
  @type('number') seatIndex: number = 0;
  /** Engine ids assigned when match starts */
  @type('string') playerId: string = '';
  @type('string') bidderId: string = '';
}

export class RoomState extends Schema {
  @type('string') phase: string = 'lobby';
  @type('string') mode: string = 'blitz';
  @type('string') difficulty: string = 'mixed';
  @type('string') hostSessionId: string = '';
  @type('string') roomCode: string = '';
  @type('number') countdown: number = 0;
  @type({ map: Seat }) seats = new MapSchema<Seat>();
}
