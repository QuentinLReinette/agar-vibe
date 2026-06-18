import {
  GameState,
  Player,
  Food,
  PACKET_TYPES,
  COLORS,
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

const wsUrl = `ws://${window.location.hostname}:8080`;
console.log("Connecting to WebSocket:", wsUrl);
const ws = new WebSocket(wsUrl);
ws.binaryType = "arraybuffer";

const renderer = new CanvasRenderer("game-canvas");
const inputManager = new InputManager();
const interpolation = new StateInterpolation();

interface RegistryEntry {
  name: string;
  color: string;
}

const playerRegistry: Map<string, RegistryEntry> = new Map();
const activeFoods: Map<string, Food> = new Map();

let localPlayerId: string | null = null;
let isPlaying = false;
let hasSpawned = false;
let latestState: GameState | null = null;

const lobby = document.getElementById("lobby")!;
const nicknameInput = document.getElementById("nickname-input")! as HTMLInputElement;
const playButton = document.getElementById("play-button")!;
const hud = document.getElementById("hud")!;
const scoreVal = document.getElementById("score-val")!;

ws.addEventListener("open", () => {
  console.log("Connected to server!");
});

ws.addEventListener("message", (event) => {
  try {
    const arrayBuffer = event.data as ArrayBuffer;
    const view = new DataView(arrayBuffer);
    const packetType = view.getUint8(0);

    switch (packetType) {
      case PACKET_TYPES.WELCOME: {
        const id = deserializeWelcome(view);
        localPlayerId = id.toString();
        console.log("Joined session with playerId:", localPlayerId);
        break;
      }
      case PACKET_TYPES.PLAYER_REGISTRY: {
        const entries = deserializePlayerRegistry(view);
        for (const entry of entries) {
          playerRegistry.set(entry.id.toString(), {
            name: entry.name,
            color: COLORS[entry.colorIndex] || "#ffffff"
          });
        }
        break;
      }
      case PACKET_TYPES.PLAYER_REMOVE: {
        const id = deserializePlayerRemove(view);
        playerRegistry.delete(id.toString());
        break;
      }
      case PACKET_TYPES.INITIAL_FOOD: {
        const foods = deserializeInitialFood(view);
        activeFoods.clear();
        for (const f of foods) {
          const foodId = f.id.toString();
          activeFoods.set(foodId, {
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
        activeFoods.set(foodId, {
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
        activeFoods.delete(foodId.toString());
        break;
      }
      case PACKET_TYPES.GAME_TICK: {
        const tick = deserializeGameTick(view);
        const players = tick.players;

        const mappedPlayers = players.map((p) => {
          const pId = p.id.toString();
          const reg = playerRegistry.get(pId);
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
          width: 4000,
          height: 4000,
          players: mappedPlayers,
          food: Array.from(activeFoods.values())
        };

        interpolation.addTick(tickState);
        latestState = tickState;
        break;
      }
    }
  } catch (err) {
    console.error("Error parsing message from server:", err);
  }
});

ws.addEventListener("close", () => {
  console.log("Connection closed.");
  showLobby();
});

function joinGame() {
  if (ws.readyState !== WebSocket.OPEN) return;

  const name = nicknameInput.value.trim() || "Guest";
  ws.send(serializeJoin(name));

  isPlaying = true;
  hasSpawned = false;
  lobby.style.opacity = "0";
  setTimeout(() => {
    if (isPlaying) {
      lobby.style.display = "none";
      hud.style.display = "block";
    }
  }, 300);

  inputManager.start();
}

function showLobby() {
  isPlaying = false;
  inputManager.stop();
  hud.style.display = "none";
  lobby.style.display = "block";
  // Trigger reflow for transition
  void lobby.offsetHeight;
  lobby.style.opacity = "1";
  nicknameInput.focus();
}

playButton.addEventListener("click", joinGame);
nicknameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") joinGame();
});

let lastInputSentTime = 0;
let lastAngle = 0;
let lastSpeed = 0;
let clientSeq = 0;

function gameTick() {
  if (isPlaying && ws.readyState === WebSocket.OPEN) {
    const input = inputManager.getInput();
    const now = performance.now();

    const angleDiff = Math.abs(input.angle - lastAngle);
    const speedDiff = Math.abs(input.speed - lastSpeed);

    if (now - lastInputSentTime > 33 || angleDiff > 0.05 || speedDiff > 0.05) {
      clientSeq++;
      ws.send(serializeInput(clientSeq, input.angle, input.speed));

      lastAngle = input.angle;
      lastSpeed = input.speed;
      lastInputSentTime = now;
    }
  }

  const state = interpolation.getInterpolatedState();
  if (state) {
    renderer.render(state, localPlayerId);

    if (isPlaying && localPlayerId) {
      const player = state.players.find((p) => p.id === localPlayerId);
      if (player) {
        scoreVal.innerText = player.score.toString();
      }
    }
  } else {
    drawLoadingScreen();
  }

  // Death detection checks against raw latestState (prevents LERP window timing bugs)
  if (isPlaying && localPlayerId && latestState) {
    const playerExists = latestState.players.some((p: Player) => p.id === localPlayerId);
    if (playerExists && !hasSpawned) {
      console.log("[DEBUG] Player found in latestState. Setting hasSpawned = true.", {
        localPlayerId,
        players: latestState.players.map((p: Player) => p.id)
      });
      hasSpawned = true;
    }

    if (hasSpawned && !playerExists) {
      console.log("[DEBUG] Game over! Died because playerExists is false but hasSpawned is true.", {
        localPlayerId,
        hasSpawned,
        playerExists,
        players: latestState.players.map((p: Player) => p.id)
      });
      showLobby();
    }
  }

  requestAnimationFrame(gameTick);
}

function drawLoadingScreen() {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#08090d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#66fcf1";
  ctx.font = '24px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CONNECTING TO VIBE SERVER...", canvas.width / 2, canvas.height / 2);
}

requestAnimationFrame(gameTick);
