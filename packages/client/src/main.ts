import {
  GameState,
  Player,
  Food,
  PACKET_TYPES,
  COLORS,
  WORLD_SIZE,
  BASE_SPEED,
  serializeJoin,
  serializeInput,
  deserializeWelcome,
  deserializePlayerRegistry,
  deserializePlayerRemove,
  deserializeGameTick,
  deserializeInitialFood,
  deserializeFoodSpawn,
  deserializeFoodEaten
} from "@agar-vibe/shared";
import { CanvasRenderer } from "./render.js";
import { InputManager } from "./input.js";
import { StateInterpolation } from "./interpolation.js";

interface RegistryEntry {
  name: string;
  color: string;
}

interface PendingInput {
  seq: number;
  angle: number;
  speed: number;
  dt: number;
}

class GameClient {
  private ws: WebSocket | null = null;
  private renderer: CanvasRenderer;
  private inputManager: InputManager;
  private interpolation: StateInterpolation;

  private playerRegistry: Map<string, RegistryEntry> = new Map();
  private activeFoods: Map<string, Food> = new Map();

  private localPlayerId: string | null = null;
  private isPlaying = false;
  private hasSpawned = false;
  private latestState: GameState | null = null;

  private pendingInputs: PendingInput[] = [];
  private predictedX = 0;
  private predictedY = 0;
  private predictedRadius = 10;
  private predictedMass = 10;

  private lobby = document.getElementById("lobby")!;
  private nicknameInput = document.getElementById("nickname-input")! as HTMLInputElement;
  private playButton = document.getElementById("play-button")!;
  private hud = document.getElementById("hud")!;
  private scoreVal = document.getElementById("score-val")!;

  private lastInputSentTime = 0;
  private lastAngle = 0;
  private lastSpeed = 0;
  private clientSeq = 0;
  private lastFrameTime = performance.now();

  constructor() {
    this.renderer = new CanvasRenderer("game-canvas");
    this.inputManager = new InputManager();
    this.interpolation = new StateInterpolation();
  }

  public init(): void {
    const productionWsUrl = import.meta.env.VITE_WS_URL;
    const localWsUrl = `ws://${window.location.hostname}:8080`;
    const wsUrl = productionWsUrl || localWsUrl;
    console.log("Connecting to WebSocket:", wsUrl);

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("open", () => {
      console.log("Connected to server!");
    });

    this.ws.addEventListener("message", (event) => this.handleMessage(event));
    this.ws.addEventListener("close", () => this.handleClose());

    this.playButton.addEventListener("click", () => this.joinGame());
    this.nicknameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.joinGame();
    });

    // Start rendering/prediction loop
    requestAnimationFrame(() => this.gameLoop());
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const arrayBuffer = event.data as ArrayBuffer;
      const view = new DataView(arrayBuffer);
      const packetType = view.getUint8(0);

      switch (packetType) {
        case PACKET_TYPES.WELCOME: {
          const id = deserializeWelcome(view);
          this.localPlayerId = id.toString();
          console.log("Joined session with playerId:", this.localPlayerId);
          break;
        }
        case PACKET_TYPES.PLAYER_REGISTRY: {
          const entries = deserializePlayerRegistry(view);
          for (const entry of entries) {
            this.playerRegistry.set(entry.id.toString(), {
              name: entry.name,
              color: COLORS[entry.colorIndex] || "#ffffff"
            });
          }
          break;
        }
        case PACKET_TYPES.PLAYER_REMOVE: {
          const id = deserializePlayerRemove(view);
          this.playerRegistry.delete(id.toString());
          break;
        }
        case PACKET_TYPES.INITIAL_FOOD: {
          const foods = deserializeInitialFood(view);
          this.activeFoods.clear();
          for (const f of foods) {
            const foodId = f.id.toString();
            this.activeFoods.set(foodId, {
              id: foodId,
              x: f.x,
              y: f.y,
              radius: 6,
              color: COLORS[f.colorIndex] || "#ffffff"
            });
          }
          break;
        }
        case PACKET_TYPES.FOOD_SPAWN: {
          const f = deserializeFoodSpawn(view);
          const foodId = f.id.toString();
          this.activeFoods.set(foodId, {
            id: foodId,
            x: f.x,
            y: f.y,
            radius: 6,
            color: COLORS[f.colorIndex] || "#ffffff"
          });
          break;
        }
        case PACKET_TYPES.FOOD_EATEN: {
          const { foodId } = deserializeFoodEaten(view);
          this.activeFoods.delete(foodId.toString());
          break;
        }
        case PACKET_TYPES.GAME_TICK: {
          const tick = deserializeGameTick(view);
          const players = tick.players;

          const mappedPlayers = players.map((p) => {
            const pId = p.id.toString();
            const reg = this.playerRegistry.get(pId);
            return {
              id: pId,
              name: reg ? reg.name : "Guest",
              color: reg ? reg.color : "#ffffff",
              cells: [
                {
                  id: `${pId}-cell-0`,
                  x: p.x,
                  y: p.y,
                  radius: p.radius,
                  mass: p.score
                }
              ],
              score: p.score
            };
          });

          const tickState: GameState = {
            width: WORLD_SIZE,
            height: WORLD_SIZE,
            players: mappedPlayers,
            food: Array.from(this.activeFoods.values())
          };

          this.interpolation.addTick(tickState);
          this.latestState = tickState;

          const serverLocalPlayer = players.find((p) => p.id === Number(this.localPlayerId));
          if (serverLocalPlayer && this.hasSpawned) {
            this.predictedX = serverLocalPlayer.x;
            this.predictedY = serverLocalPlayer.y;
            this.predictedRadius = serverLocalPlayer.radius;
            this.predictedMass = serverLocalPlayer.score;

            while (
              this.pendingInputs.length > 0 &&
              this.pendingInputs[0].seq <= tick.lastProcessedSeq
            ) {
              this.pendingInputs.shift();
            }

            for (const pending of this.pendingInputs) {
              const predicted = this.predictCellPosition(
                this.predictedX,
                this.predictedY,
                this.predictedRadius,
                this.predictedMass,
                pending.angle,
                pending.speed,
                pending.dt
              );
              this.predictedX = predicted.x;
              this.predictedY = predicted.y;
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("Error parsing message from server:", err);
    }
  }

  private handleClose(): void {
    console.log("Connection closed.");
    this.showLobby();
  }

  private joinGame(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const name = this.nicknameInput.value.trim() || "Guest";
    this.ws.send(serializeJoin(name));

    this.isPlaying = true;
    this.hasSpawned = false;
    this.lobby.style.opacity = "0";
    setTimeout(() => {
      if (this.isPlaying) {
        this.lobby.style.display = "none";
        this.hud.style.display = "block";
      }
    }, 300);

    this.inputManager.start();
  }

  private showLobby(): void {
    this.isPlaying = false;
    this.inputManager.stop();
    this.hud.style.display = "none";
    this.lobby.style.display = "block";
    // Trigger reflow for transition
    void this.lobby.offsetHeight;
    this.lobby.style.opacity = "1";
    this.nicknameInput.focus();
    this.pendingInputs.length = 0;
    this.clientSeq = 0;
  }

  private predictCellPosition(
    x: number,
    y: number,
    radius: number,
    mass: number,
    angle: number,
    speed: number,
    dt: number
  ): { x: number; y: number } {
    const speedModifier = BASE_SPEED / Math.sqrt(mass);
    const velocity = speedModifier * speed;
    const newX = x + Math.cos(angle) * velocity * dt;
    const newY = y + Math.sin(angle) * velocity * dt;
    return {
      x: Math.max(radius, Math.min(WORLD_SIZE - radius, newX)),
      y: Math.max(radius, Math.min(WORLD_SIZE - radius, newY))
    };
  }

  private gameLoop(): void {
    const now = performance.now();
    let dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    dt = Math.min(dt, 0.1);

    if (this.isPlaying && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const input = this.inputManager.getInput();

      const angleDiff = Math.abs(input.angle - this.lastAngle);
      const speedDiff = Math.abs(input.speed - this.lastSpeed);

      if (now - this.lastInputSentTime > 33 || angleDiff > 0.05 || speedDiff > 0.05) {
        this.clientSeq++;
        this.ws.send(serializeInput(this.clientSeq, input.angle, input.speed));

        this.lastAngle = input.angle;
        this.lastSpeed = input.speed;
        this.lastInputSentTime = now;
      }

      if (this.hasSpawned) {
        const predicted = this.predictCellPosition(
          this.predictedX,
          this.predictedY,
          this.predictedRadius,
          this.predictedMass,
          input.angle,
          input.speed,
          dt
        );
        this.predictedX = predicted.x;
        this.predictedY = predicted.y;

        this.pendingInputs.push({
          seq: this.clientSeq,
          angle: input.angle,
          speed: input.speed,
          dt
        });
      }
    }

    const state = this.interpolation.getInterpolatedState();
    if (state) {
      if (this.isPlaying && this.hasSpawned) {
        this.renderer.render(
          state,
          this.localPlayerId,
          this.predictedX,
          this.predictedY,
          this.predictedRadius
        );
      } else {
        this.renderer.render(state, this.localPlayerId);
      }

      if (this.isPlaying && this.localPlayerId) {
        const player = state.players.find((p) => p.id === this.localPlayerId);
        if (player) {
          this.scoreVal.innerText = player.score.toString();
        }
      }
    } else {
      this.drawLoadingScreen();
    }

    // Death detection checks against raw latestState (prevents LERP window timing bugs)
    if (this.isPlaying && this.localPlayerId && this.latestState) {
      const playerExists = this.latestState.players.some(
        (p: Player) => p.id === this.localPlayerId
      );
      if (this.hasSpawned && !playerExists) {
        console.log("[DEBUG] Player not found in latestState. Death triggered.");
        this.showLobby();
      } else if (!this.hasSpawned && playerExists) {
        console.log("[DEBUG] Player found in latestState. Setting hasSpawned = true.");
        this.hasSpawned = true;
      }
    }

    requestAnimationFrame(() => this.gameLoop());
  }

  private drawLoadingScreen(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ctx = (document.getElementById("game-canvas") as HTMLCanvasElement).getContext("2d")!;
    ctx.fillStyle = "#08090d";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 24px "Inter", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Connecting to Server...", width / 2, height / 2);
  }
}

// Start Game Client
const client = new GameClient();
client.init();
