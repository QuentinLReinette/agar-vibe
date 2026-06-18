import { WebSocketServer } from "ws";
import { version } from "@agar-vibe/shared";

const port = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port });

console.log(`Server starting on port ${port}, shared version: ${version}`);

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send(JSON.stringify({ type: "welcome", version }));

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
