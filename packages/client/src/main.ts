import { version } from "@agar-vibe/shared";

console.log("Client starting. Shared version:", version);

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function draw() {
  if (!ctx) return;
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#66fcf1";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Agar-Vibe client loaded (v${version})`, canvas.width / 2, canvas.height / 2);

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// WebSocket connection
const wsUrl = `ws://${window.location.hostname}:8080`;
console.log("Connecting to WebSocket:", wsUrl);
const ws = new WebSocket(wsUrl);

ws.addEventListener("open", () => {
  console.log("Connected to server!");
  ws.send("Hello from client!");
});

ws.addEventListener("message", (event) => {
  console.log("Message from server:", event.data);
});

ws.addEventListener("error", (err) => {
  console.error("WebSocket error:", err);
});

ws.addEventListener("close", () => {
  console.log("Connection closed.");
});
