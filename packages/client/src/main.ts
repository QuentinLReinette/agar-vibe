import { ServerMessage, ClientMessage, GameState, Player } from "@agar-vibe/shared";
import { CanvasRenderer } from "./render.js";
import { InputManager } from "./input.js";
import { StateInterpolation } from "./interpolation.js";

const wsUrl = `ws://${window.location.hostname}:8080`;
console.log("Connecting to WebSocket:", wsUrl);
const ws = new WebSocket(wsUrl);

const renderer = new CanvasRenderer("game-canvas");
const inputManager = new InputManager();
const interpolation = new StateInterpolation();

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
    const data = JSON.parse(event.data) as ServerMessage;

    switch (data.type) {
      case "welcome":
        localPlayerId = data.playerId;
        console.log("Joined session with playerId:", localPlayerId);
        break;
      case "tick":
        interpolation.addTick(data.state);
        latestState = data.state;
        break;
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
  const joinPacket: ClientMessage = {
    type: "join",
    name
  };

  ws.send(JSON.stringify(joinPacket));

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

function gameTick() {
  if (isPlaying && ws.readyState === WebSocket.OPEN) {
    const input = inputManager.getInput();
    const now = performance.now();

    const angleDiff = Math.abs(input.angle - lastAngle);
    const speedDiff = Math.abs(input.speed - lastSpeed);

    if (now - lastInputSentTime > 33 || angleDiff > 0.05 || speedDiff > 0.05) {
      const inputPacket: ClientMessage = {
        type: "input",
        angle: input.angle,
        speed: input.speed
      };
      ws.send(JSON.stringify(inputPacket));

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
