export const PACKET_TYPES = {
  // Client -> Server
  JOIN: 1,
  INPUT: 2,

  // Server -> Client
  WELCOME: 10,
  PLAYER_REGISTRY: 11,
  PLAYER_REMOVE: 12,
  GAME_TICK: 13,
  INITIAL_FOOD: 14,
  FOOD_SPAWN: 15,
  FOOD_EATEN: 16
};

// Map size is shared constant
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4000;
export const COLORS = [
  "#ff5722", // orange
  "#e91e63", // pink
  "#9c27b0", // purple
  "#3f51b5", // indigo
  "#00bcd4", // cyan
  "#4caf50", // green
  "#ffeb3b", // yellow
  "#ff9800", // amber
  "#009688", // teal
  "#673ab7" // deep purple
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- CLIENT TO SERVER PACKETS ---

export function serializeJoin(name: string): ArrayBuffer {
  const nameBytes = encoder.encode(name);
  const nameLen = Math.min(255, nameBytes.length);

  const buffer = new ArrayBuffer(2 + nameLen);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.JOIN);
  view.setUint8(1, nameLen);

  const uint8 = new Uint8Array(buffer, 2, nameLen);
  uint8.set(nameBytes.subarray(0, nameLen));

  return buffer;
}

export function deserializeJoin(view: DataView): string {
  const nameLen = view.getUint8(1);
  const nameBytes = new Uint8Array(view.buffer, view.byteOffset + 2, nameLen);
  return decoder.decode(nameBytes);
}

export function serializeInput(seq: number, angle: number, speed: number): ArrayBuffer {
  const buffer = new ArrayBuffer(10);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.INPUT);
  view.setUint32(1, seq, true);
  view.setFloat32(5, angle, true);
  view.setUint8(9, speed > 0 ? 1 : 0);

  return buffer;
}

export function deserializeInput(view: DataView): { seq: number; angle: number; speed: number } {
  const seq = view.getUint32(1, true);
  const angle = view.getFloat32(5, true);
  const speed = view.getUint8(9);
  return { seq, angle, speed };
}

// --- SERVER TO CLIENT PACKETS ---

export function serializeWelcome(playerId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.WELCOME);
  view.setUint32(1, playerId, true);

  return buffer;
}

export function deserializeWelcome(view: DataView): number {
  return view.getUint32(1, true);
}

export interface RegistryEntry {
  id: number;
  colorIndex: number;
  name: string;
}

export function serializePlayerRegistry(entries: RegistryEntry[]): ArrayBuffer {
  // First calculate buffer size
  let size = 3; // Type (1) + Count (2)
  const encodedNames: Uint8Array[] = [];

  for (const entry of entries) {
    const encoded = encoder.encode(entry.name);
    encodedNames.push(encoded);
    size += 4 + 1 + 1 + Math.min(255, encoded.length); // id (4) + colorIndex (1) + nameLen (1) + name
  }

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.PLAYER_REGISTRY);
  view.setUint16(1, entries.length, true);

  let offset = 3;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const encoded = encodedNames[i];
    const nameLen = Math.min(255, encoded.length);

    view.setUint32(offset, entry.id, true);
    view.setUint8(offset + 4, entry.colorIndex);
    view.setUint8(offset + 5, nameLen);

    const uint8 = new Uint8Array(buffer, offset + 6, nameLen);
    uint8.set(encoded.subarray(0, nameLen));

    offset += 6 + nameLen;
  }

  return buffer;
}

export function deserializePlayerRegistry(view: DataView): RegistryEntry[] {
  const count = view.getUint16(1, true);
  const entries: RegistryEntry[] = [];

  let offset = 3;
  for (let i = 0; i < count; i++) {
    const id = view.getUint32(offset, true);
    const colorIndex = view.getUint8(offset + 4);
    const nameLen = view.getUint8(offset + 5);

    const nameBytes = new Uint8Array(view.buffer, view.byteOffset + offset + 6, nameLen);
    const name = decoder.decode(nameBytes);

    entries.push({ id, colorIndex, name });
    offset += 6 + nameLen;
  }

  return entries;
}

export function serializePlayerRemove(playerId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.PLAYER_REMOVE);
  view.setUint32(1, playerId, true);

  return buffer;
}

export function deserializePlayerRemove(view: DataView): number {
  return view.getUint32(1, true);
}

export interface TickPlayerEntry {
  id: number;
  x: number;
  y: number;
  radius: number;
  score: number;
}

export function serializeGameTick(
  lastProcessedSeq: number,
  players: TickPlayerEntry[]
): ArrayBuffer {
  const buffer = new ArrayBuffer(7 + players.length * 20);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.GAME_TICK);
  view.setUint32(1, lastProcessedSeq, true);
  view.setUint16(5, players.length, true);

  let offset = 7;
  for (const player of players) {
    view.setUint32(offset, player.id, true);
    view.setFloat32(offset + 4, player.x, true);
    view.setFloat32(offset + 8, player.y, true);
    view.setFloat32(offset + 12, player.radius, true);
    view.setUint32(offset + 16, player.score, true);
    offset += 20;
  }

  return buffer;
}

export function deserializeGameTick(view: DataView): {
  lastProcessedSeq: number;
  players: TickPlayerEntry[];
} {
  const lastProcessedSeq = view.getUint32(1, true);
  const count = view.getUint16(5, true);
  const players: TickPlayerEntry[] = [];

  let offset = 7;
  for (let i = 0; i < count; i++) {
    const id = view.getUint32(offset, true);
    const x = view.getFloat32(offset + 4, true);
    const y = view.getFloat32(offset + 8, true);
    const radius = view.getFloat32(offset + 12, true);
    const score = view.getUint32(offset + 16, true);

    players.push({ id, x, y, radius, score });
    offset += 20;
  }

  return { lastProcessedSeq, players };
}

export interface BinaryFood {
  id: number;
  x: number; // uint16
  y: number; // uint16
  colorIndex: number;
}

export function serializeInitialFood(foods: BinaryFood[]): ArrayBuffer {
  const buffer = new ArrayBuffer(3 + foods.length * 7);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.INITIAL_FOOD);
  view.setUint16(1, foods.length, true);

  let offset = 3;
  for (const food of foods) {
    view.setUint16(offset, food.id, true);
    view.setUint16(offset + 2, food.x, true);
    view.setUint16(offset + 4, food.y, true);
    view.setUint8(offset + 6, food.colorIndex);
    offset += 7;
  }

  return buffer;
}

export function deserializeInitialFood(view: DataView): BinaryFood[] {
  const count = view.getUint16(1, true);
  const foods: BinaryFood[] = [];

  let offset = 3;
  for (let i = 0; i < count; i++) {
    const id = view.getUint16(offset, true);
    const x = view.getUint16(offset + 2, true);
    const y = view.getUint16(offset + 4, true);
    const colorIndex = view.getUint8(offset + 6);

    foods.push({ id, x, y, colorIndex });
    offset += 7;
  }

  return foods;
}

export function serializeFoodSpawn(food: BinaryFood): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.FOOD_SPAWN);
  view.setUint16(1, food.id, true);
  view.setUint16(3, food.x, true);
  view.setUint16(5, food.y, true);
  view.setUint8(7, food.colorIndex);

  return buffer;
}

export function deserializeFoodSpawn(view: DataView): BinaryFood {
  const id = view.getUint16(1, true);
  const x = view.getUint16(3, true);
  const y = view.getUint16(5, true);
  const colorIndex = view.getUint8(7);
  return { id, x, y, colorIndex };
}

export function serializeFoodEaten(foodId: number, playerId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(7);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_TYPES.FOOD_EATEN);
  view.setUint16(1, foodId, true);
  view.setUint32(3, playerId, true);

  return buffer;
}

export function deserializeFoodEaten(view: DataView): { foodId: number; playerId: number } {
  const foodId = view.getUint16(1, true);
  const playerId = view.getUint32(3, true);
  return { foodId, playerId };
}
