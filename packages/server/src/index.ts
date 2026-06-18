import { WebSocketServer, WebSocket } from "ws";
import {
  PACKET_TYPES,
  COLORS,
  serializeWelcome,
  serializePlayerRegistry,
  serializePlayerRemove,
  serializeGameTick,
  serializeInitialFood,
  serializeFoodSpawn,
  serializeFoodEaten,
  deserializeJoin,
  deserializeInput
} from "@agar-vibe/shared";
import { GameEngine } from "./game.js";

const port = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port });

const gameEngine = new GameEngine();
const clients: Map<string, WebSocket> = new Map();
const lastProcessedSeq: Map<string, number> = new Map();
let playerCounter = 0;

console.log(
  `Server starting on port ${port}, world size: ${gameEngine.width}x${gameEngine.height}`
);

interface ExtWebSocket extends WebSocket {
  isAlive?: boolean;
}

wss.on("connection", (ws) => {
  const numericId = ++playerCounter;
  const playerId = numericId.toString();
  clients.set(playerId, ws);

  const extWs = ws as ExtWebSocket;
  extWs.isAlive = true;
  extWs.on("pong", () => {
    extWs.isAlive = true;
  });

  console.log(`Client connected: ${playerId}`);

  // 1. Send welcome message
  ws.send(Buffer.from(serializeWelcome(numericId)));

  // 2. Send current player registry
  const activePlayers = gameEngine.getSerializedState().players;
  if (activePlayers.length > 0) {
    const registryEntries = activePlayers.map((p) => ({
      id: Number(p.id),
      colorIndex: COLORS.indexOf(p.color),
      name: p.name
    }));
    ws.send(Buffer.from(serializePlayerRegistry(registryEntries)));
  }

  // 3. Send initial food list
  const foods = gameEngine.getSerializedState().food.map((f) => ({
    id: Number(f.id),
    x: Math.round(f.x),
    y: Math.round(f.y),
    colorIndex: COLORS.indexOf(f.color)
  }));
  ws.send(Buffer.from(serializeInitialFood(foods)));

  ws.on("message", (rawMessage) => {
    try {
      const buffer = rawMessage as Buffer;
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const packetType = view.getUint8(0);

      switch (packetType) {
        case PACKET_TYPES.JOIN: {
          const name = deserializeJoin(view);
          gameEngine.addPlayer(playerId, name);
          console.log(`Player ${playerId} joined as: "${name}"`);

          const playerObj = gameEngine.getSerializedState().players.find((p) => p.id === playerId);
          if (playerObj) {
            const entry = {
              id: numericId,
              colorIndex: COLORS.indexOf(playerObj.color),
              name: playerObj.name
            };
            const registryBuffer = Buffer.from(serializePlayerRegistry([entry]));
            for (const clientWs of clients.values()) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(registryBuffer);
              }
            }
          }
          break;
        }
        case PACKET_TYPES.INPUT: {
          const { seq, angle, speed } = deserializeInput(view);
          gameEngine.updateInput(playerId, angle, speed);
          lastProcessedSeq.set(playerId, seq);
          break;
        }
      }
    } catch (err) {
      console.error(`Error processing message from ${playerId}:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected: ${playerId}`);
    gameEngine.removePlayer(playerId);
    clients.delete(playerId);
    lastProcessedSeq.delete(playerId);

    const removeBuffer = Buffer.from(serializePlayerRemove(numericId));
    for (const clientWs of clients.values()) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(removeBuffer);
      }
    }
  });
});

// Fixed-timestep game loop (60Hz physics, 20Hz broadcast)
let lastTime = performance.now();
const tickLengthMs = 1000 / 60; // 16.67ms
let tickCount = 0;

function gameLoop() {
  const now = performance.now();
  let delta = now - lastTime;

  let physicsTicks = 0;
  while (delta >= tickLengthMs && physicsTicks < 5) {
    // Tick game engine at 60Hz physics update rate
    gameEngine.tick(1 / 60);
    delta -= tickLengthMs;
    lastTime += tickLengthMs;
    physicsTicks++;
    tickCount++;

    // Broadcast tick updates to clients at 20Hz (once every 3 physics ticks)
    if (tickCount % 3 === 0) {
      broadcastState();
    }
  }

  // Schedule next iteration (accounting for execution time)
  const executionTime = performance.now() - now;
  setTimeout(gameLoop, Math.max(1, tickLengthMs - executionTime));
}

function broadcastState() {
  // 1. Broadcast food events
  const foodEvents = gameEngine.pendingFoodEvents;
  if (foodEvents.length > 0) {
    for (const event of foodEvents) {
      let buffer: ArrayBuffer;
      if (event.type === "spawn") {
        buffer = serializeFoodSpawn({
          id: Number(event.food.id),
          x: Math.round(event.food.x),
          y: Math.round(event.food.y),
          colorIndex: COLORS.indexOf(event.food.color)
        });
      } else {
        buffer = serializeFoodEaten(Number(event.foodId), Number(event.playerId));
      }
      const buf = Buffer.from(buffer);
      for (const ws of clients.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buf);
        }
      }
    }
    gameEngine.pendingFoodEvents = [];
  }

  // 2. Broadcast game ticks (individualized for each client)
  const serializedState = gameEngine.getSerializedState();
  const tickPlayers = serializedState.players.map((p) => ({
    id: Number(p.id),
    x: p.cells[0]?.x || 0,
    y: p.cells[0]?.y || 0,
    radius: p.cells[0]?.radius || 0,
    score: p.score
  }));

  for (const [pId, ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      const lastSeq = lastProcessedSeq.get(pId) || 0;
      const tickBuffer = serializeGameTick(lastSeq, tickPlayers);
      ws.send(Buffer.from(tickBuffer));
    }
  }
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtWebSocket;
    if (extWs.isAlive === false) {
      console.log("Terminating unresponsive connection");
      return extWs.terminate();
    }
    extWs.isAlive = false;
    extWs.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

// Start game loop
gameLoop();
