import {
  serializeJoin,
  deserializeJoin,
  serializeInput,
  deserializeInput,
  serializeWelcome,
  deserializeWelcome,
  serializePlayerRegistry,
  deserializePlayerRegistry,
  serializePlayerRemove,
  deserializePlayerRemove,
  serializeGameTick,
  deserializeGameTick,
  serializeInitialFood,
  deserializeInitialFood,
  serializeFoodSpawn,
  deserializeFoodSpawn,
  serializeFoodEaten,
  deserializeFoodEaten
} from "../src/network/binary.js";

describe("Binary Protocol Serialization", () => {
  test("Join message", () => {
    const buffer = serializeJoin("TestPlayer");
    const view = new DataView(buffer);
    const name = deserializeJoin(view);
    expect(name).toBe("TestPlayer");
  });

  test("Input message", () => {
    const buffer = serializeInput(42, 1.23, 1);
    const view = new DataView(buffer);
    const input = deserializeInput(view);
    expect(input.seq).toBe(42);
    expect(input.angle).toBeCloseTo(1.23, 5);
    expect(input.speed).toBe(1);
  });

  test("Welcome message", () => {
    const buffer = serializeWelcome(99);
    const view = new DataView(buffer);
    const id = deserializeWelcome(view);
    expect(id).toBe(99);
  });

  test("Player Registry", () => {
    const entries = [
      { id: 1, colorIndex: 2, name: "Alice" },
      { id: 2, colorIndex: 5, name: "Bob" }
    ];
    const buffer = serializePlayerRegistry(entries);
    const view = new DataView(buffer);
    const decoded = deserializePlayerRegistry(view);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toEqual(entries[0]);
    expect(decoded[1]).toEqual(entries[1]);
  });

  test("Player Remove", () => {
    const buffer = serializePlayerRemove(7);
    const view = new DataView(buffer);
    const id = deserializePlayerRemove(view);
    expect(id).toBe(7);
  });

  test("Game Tick", () => {
    const players = [
      { id: 10, x: 100.5, y: 200.25, radius: 15.0, score: 30 },
      { id: 20, x: 400.0, y: 500.75, radius: 25.5, score: 65 }
    ];
    const buffer = serializeGameTick(105, players);
    const view = new DataView(buffer);
    const decoded = deserializeGameTick(view);
    expect(decoded.lastProcessedSeq).toBe(105);
    expect(decoded.players).toHaveLength(2);
    expect(decoded.players[0].id).toBe(10);
    expect(decoded.players[0].x).toBeCloseTo(100.5, 4);
    expect(decoded.players[0].y).toBeCloseTo(200.25, 4);
    expect(decoded.players[0].radius).toBeCloseTo(15.0, 4);
    expect(decoded.players[0].score).toBe(30);
  });

  test("Initial Food List", () => {
    const foods = [
      { id: 1, x: 100, y: 200, colorIndex: 1 },
      { id: 2, x: 300, y: 400, colorIndex: 3 }
    ];
    const buffer = serializeInitialFood(foods);
    const view = new DataView(buffer);
    const decoded = deserializeInitialFood(view);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toEqual(foods[0]);
    expect(decoded[1]).toEqual(foods[1]);
  });

  test("Food Spawn", () => {
    const food = { id: 12, x: 500, y: 600, colorIndex: 4 };
    const buffer = serializeFoodSpawn(food);
    const view = new DataView(buffer);
    const decoded = deserializeFoodSpawn(view);
    expect(decoded).toEqual(food);
  });

  test("Food Eaten", () => {
    const buffer = serializeFoodEaten(15, 3);
    const view = new DataView(buffer);
    const decoded = deserializeFoodEaten(view);
    expect(decoded.foodId).toBe(15);
    expect(decoded.playerId).toBe(3);
  });
});
