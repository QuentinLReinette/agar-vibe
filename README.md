# Agar-Vibe

A real-time multiplayer Agar.io clone built during a Vibe Coding project.

---

## 1. Project Overview

Agar-Vibe is an authoritative multiplayer `.io` game where players steer cells to consume food and other players. The client renders the arena using HTML5 Canvas and predicts local movement in real time while interpolating other entities. The server runs the physics loop and broadcasts state ticks using a custom binary protocol.

**Developer:** Quentin L. Reinette  
**Production URL:** [https://agar-vibe-client.onrender.com/](https://agar-vibe-client.onrender.com/)  

### Local Development Launch Instructions

1. **Start Services**: Make sure Docker and Docker Compose are running, then build and start the containers:

   ```bash
   docker compose up --build
   ```

   - Client: `http://localhost:5173`
   - Server: `ws://localhost:8080`

2. **Run Tests**: Execute the test, lint, and formatting verification suite inside the server container:

   ```bash
   docker compose exec server npm run check
   ```

---

## 2. The AI Arsenal & Agentic Ecosystem

- **Tools and LLMs**: Gemini models run via the Antigravity IDE agentic loops.
- **MCP Servers & Context**: Used workspace directory listings, grep search, and file modification tools to provide workspace file state to the agent.
- **Specialized Skills & System Rules**:
  - `AGENTS.md` system directives: Enforced OOP, SOLID design, and strict decoupling between rendering (Canvas), network (WebSockets/binary), and physics modules.
  - Custom scripts in `.agents/skills/`:
    - `ponytail`: Enforces minimal code footprints and native APIs over external libraries.
    - `caveman`: Enforces token-efficient communication.
    - `junior-to-senior`: Audits plan depth before starting work.

---

## 3. Prompt Engineering

These Master Prompts guided the scaffolding of the monorepo architecture and client prediction loop:

1. **Monorepo Blueprint Scaffolding Prompt**:
   > "You are a Senior Game Developer and AI Orchestrator. We are officially bootstrapping our multiplayer ".io" game (Agar.io clone). Based on our architectural stack alignment, we are using:
   > - **Language:** TypeScript (Strictly typed, Monorepo structure shared between client/server)
   > - **Backend:** Node.js + vanilla `ws` library (Authoritative server with fixed-timestep game loop)
   > - **Frontend Renderer:** HTML5 2D Canvas API (Vanilla implementation for max performance)
   > - **Frontend UI & Build Tool:** Vite + Vanilla HTML/CSS (Atomic Design & Design Tokens)
   > - **Infrastructure:** Docker (Multi-stage builds for local development and production orchestration)
   >
   > Generate the Master Development Plan: Analyze our stack and create a strict, phased development plan. The plan must adhere fully to OOP, SOLID, KISS, DRY, and YAGNI."

2. **Reconciliation Loop Prompt**:
   > "Implement client-side prediction and server reconciliation. The client must store outgoing inputs in a sequence-numbered queue. When the server returns its latest state tick with the last processed sequence ID, the client must discard all acknowledged inputs from the queue and replay the remaining unacknowledged inputs starting from the server's absolute coordinates. Encapsulate this logic in a prediction module without breaking entity rendering."

---

## 4. Critical Analysis & Hallucinations

### Where the AI Excelled

- **Spatial Partitioning**: Implemented bucket-partitioning (200px cells) to query nearby food in $O(1)$ time, avoiding $O(N)$ nested loops.
- **Strict OOP Restructuring**: Refactored procedural scripts into decoupled classes (`GameClient`, `GameServer`, `BotManager`), separating math, network serialization, and rendering.
- **Binary Protocol**: Implemented a little-endian binary packet protocol using `DataView` buffers to replace JSON packets, reducing wire payload size.

### Where the AI Failed & Hallucinated (Autopsy)

- **Bot ID `NaN` Casting Bug**: The server originally used alphanumeric strings (e.g., `'bot-10000'`) for bot IDs. The binary packet parser expected integers, casting them to `NaN` and corrupting the buffer.
  *Resolution:* Assigned numeric IDs starting at `10000` to fit the `uint32` payload.
- **60Hz DOM Layout Thrashing**: The client updated the leaderboard DOM at 60Hz, causing layout thrashing and frame drops.
  *Resolution:* Throttled updates to 5Hz and skipped DOM writes if the new HTML string matched the current `innerHTML`.
- **Static Spectator Viewport**: The spectator camera remained static because drawing coordinates were gated behind local player cell checks.
  *Resolution:* Decoupled camera centering from local player checks to follow the spectated entity coordinate buffer.
- **AI Bot Overlap Locking**: Bots of similar mass got stuck overlapping because deterministic steering formulas made them seek identical coordinates.
  *Resolution:* Added random steering noise (variance) to their flee, hunt, and feed behaviors in `bot.ts` to break the lock.
