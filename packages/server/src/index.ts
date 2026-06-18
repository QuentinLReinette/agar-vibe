import { WebSocketServer, WebSocket } from "ws";
import { ServerMessage, ClientMessage, ServerMessageTick } from "@agar-vibe/shared";
import { GameEngine } from "./game.js";

const port = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port });

const gameEngine = new GameEngine();
const clients: Map<string, WebSocket> = new Map();

console.log(`Server starting on port ${port}, world size: ${gameEngine.width}x${gameEngine.height}`);

wss.on("connection", (ws) => {
  const playerId = `p-${Math.random().toString(36).substring(2, 9)}`;
  clients.set(playerId, ws);

  console.log(`Client connected: ${playerId}`);

  // Send welcome message
  const welcomeMessage: ServerMessage = {
    type: "welcome",
    playerId,
    width: gameEngine.width,
    height: gameEngine.height
  };
  ws.send(JSON.stringify(welcomeMessage));

  ws.on("message", (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString()) as ClientMessage;
      
      switch (message.type) {
        case "join":
          gameEngine.addPlayer(playerId, message.name);
          console.log(`Player ${playerId} joined as: "${message.name}"`);
          break;
        case "input":
          gameEngine.updateInput(playerId, message.angle, message.speed);
          break;
      }
    } catch (err) {
      console.error(`Error processing message from ${playerId}:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected: ${playerId}`);
    gameEngine.removePlayer(playerId);
    clients.delete(playerId);
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
  const state = gameEngine.getSerializedState();
  const tickMessage: ServerMessageTick = {
    type: "tick",
    state
  };
  const payload = JSON.stringify(tickMessage);

  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Start game loop
gameLoop();
