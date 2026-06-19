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

interface ExtWebSocket extends WebSocket {
  isAlive?: boolean;
}

class GameServer {
  private wss: WebSocketServer;
  private gameEngine: GameEngine;
  private clients: Map<string, WebSocket> = new Map();
  private lastProcessedSeq: Map<string, number> = new Map();
  private playerCounter = 0;
  private interval: NodeJS.Timeout | null = null;
  private lastTime = performance.now();
  private readonly tickLengthMs = 1000 / 60;
  private tickCount = 0;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.gameEngine = new GameEngine();
  }

  public start(): void {
    console.log(`Server starting, world size: ${this.gameEngine.width}x${this.gameEngine.height}`);

    this.wss.on("connection", (ws) => this.handleConnection(ws));
    this.wss.on("close", () => this.handleCloseServer());

    this.startHeartbeatCheck();
    this.gameLoop();
  }

  private handleConnection(ws: WebSocket): void {
    const numericId = ++this.playerCounter;
    const playerId = numericId.toString();
    this.clients.set(playerId, ws);

    const extWs = ws as ExtWebSocket;
    extWs.isAlive = true;
    extWs.on("pong", () => {
      extWs.isAlive = true;
    });

    console.log(`Client connected: ${playerId}`);

    // 1. Send welcome message
    ws.send(Buffer.from(serializeWelcome(numericId)));

    // 2. Send current player registry
    const activePlayers = this.gameEngine.getSerializedState().players;
    if (activePlayers.length > 0) {
      const registryEntries = activePlayers.map((p) => ({
        id: Number(p.id),
        colorIndex: COLORS.indexOf(p.color),
        name: p.name
      }));
      ws.send(Buffer.from(serializePlayerRegistry(registryEntries)));
    }

    // 3. Send initial food list
    const foods = this.gameEngine.getSerializedState().food.map((f) => ({
      id: Number(f.id),
      x: Math.round(f.x),
      y: Math.round(f.y),
      colorIndex: COLORS.indexOf(f.color)
    }));
    ws.send(Buffer.from(serializeInitialFood(foods)));

    ws.on("message", (rawMessage) => this.handleMessage(playerId, numericId, rawMessage));
    ws.on("close", () => this.handleDisconnect(playerId, numericId));
  }

  private handleMessage(playerId: string, numericId: number, rawMessage: unknown): void {
    try {
      const buffer = rawMessage as Buffer;
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const packetType = view.getUint8(0);

      switch (packetType) {
        case PACKET_TYPES.JOIN: {
          const name = deserializeJoin(view);
          this.gameEngine.addPlayer(playerId, name);
          console.log(`Player ${playerId} joined as: "${name}"`);

          const playerObj = this.gameEngine
            .getSerializedState()
            .players.find((p) => p.id === playerId);
          if (playerObj) {
            const entry = {
              id: numericId,
              colorIndex: COLORS.indexOf(playerObj.color),
              name: playerObj.name
            };
            const registryBuffer = Buffer.from(serializePlayerRegistry([entry]));
            for (const clientWs of this.clients.values()) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(registryBuffer);
              }
            }
          }
          break;
        }
        case PACKET_TYPES.INPUT: {
          const { seq, angle, speed } = deserializeInput(view);
          this.gameEngine.updateInput(playerId, angle, speed);
          this.lastProcessedSeq.set(playerId, seq);
          break;
        }
      }
    } catch (err) {
      console.error(`Error processing message from ${playerId}:`, err);
    }
  }

  private handleDisconnect(playerId: string, numericId: number): void {
    console.log(`Client disconnected: ${playerId}`);
    this.gameEngine.removePlayer(playerId);
    this.clients.delete(playerId);
    this.lastProcessedSeq.delete(playerId);

    const removeBuffer = Buffer.from(serializePlayerRemove(numericId));
    for (const clientWs of this.clients.values()) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(removeBuffer);
      }
    }
  }

  private gameLoop = (): void => {
    const now = performance.now();
    let delta = now - this.lastTime;

    let physicsTicks = 0;
    while (delta >= this.tickLengthMs && physicsTicks < 5) {
      this.gameEngine.tick(1 / 60);
      delta -= this.tickLengthMs;
      this.lastTime += this.tickLengthMs;
      physicsTicks++;
      this.tickCount++;

      if (this.tickCount % 3 === 0) {
        this.broadcastState();
      }
    }

    const executionTime = performance.now() - now;
    setTimeout(this.gameLoop, Math.max(1, this.tickLengthMs - executionTime));
  };

  private broadcastState(): void {
    // 1. Broadcast food events
    const foodEvents = this.gameEngine.pendingFoodEvents;
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
        for (const ws of this.clients.values()) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buf);
          }
        }
      }
      this.gameEngine.pendingFoodEvents = [];
    }

    // 2. Broadcast game ticks
    const serializedState = this.gameEngine.getSerializedState();
    const tickPlayers = serializedState.players.map((p) => ({
      id: Number(p.id),
      x: p.cells[0]?.x || 0,
      y: p.cells[0]?.y || 0,
      radius: p.cells[0]?.radius || 0,
      score: p.score
    }));

    for (const [pId, ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        const lastSeq = this.lastProcessedSeq.get(pId) || 0;
        const tickBuffer = serializeGameTick(lastSeq, tickPlayers);
        ws.send(Buffer.from(tickBuffer));
      }
    }
  }

  private startHeartbeatCheck(): void {
    this.interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const extWs = ws as ExtWebSocket;
        if (extWs.isAlive === false) {
          console.log("Terminating unresponsive connection");
          return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000);
  }

  private handleCloseServer(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}

const port = Number(process.env.PORT) || 8080;
const server = new GameServer(port);
server.start();
