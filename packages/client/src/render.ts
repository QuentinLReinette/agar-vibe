import { GameState, PlayerCell } from "@agar-vibe/shared";

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  public render(state: GameState, localPlayerId: string | null): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.fillStyle = "#08090d";
    this.ctx.fillRect(0, 0, width, height);

    let camX = state.width / 2;
    let camY = state.height / 2;

    const localPlayer = localPlayerId ? state.players.find((p) => p.id === localPlayerId) : null;
    if (localPlayer && localPlayer.cells.length > 0) {
      let sumX = 0;
      let sumY = 0;
      for (const cell of localPlayer.cells) {
        sumX += cell.x;
        sumY += cell.y;
      }
      camX = sumX / localPlayer.cells.length;
      camY = sumY / localPlayer.cells.length;
    }

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.translate(-camX, -camY);

    this.drawGrid(state.width, state.height, camX, camY, width, height);

    this.ctx.strokeStyle = "rgba(102, 252, 241, 0.4)";
    this.ctx.lineWidth = 8;
    this.ctx.strokeRect(0, 0, state.width, state.height);

    for (const food of state.food) {
      this.ctx.beginPath();
      this.ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = food.color;
      this.ctx.fill();
    }

    const sortedPlayers = [...state.players].sort((a, b) => {
      if (a.id === localPlayerId) return 1;
      if (b.id === localPlayerId) return -1;
      return 0;
    });

    for (const player of sortedPlayers) {
      const isLocal = player.id === localPlayerId;
      for (const cell of player.cells) {
        this.drawCell(cell, player.name, player.color, isLocal);
      }
    }

    this.ctx.restore();
  }

  private drawGrid(
    worldWidth: number,
    worldHeight: number,
    camX: number,
    camY: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    this.ctx.lineWidth = 1;

    const gridSpacing = 80;

    const left = camX - screenWidth / 2;
    const right = camX + screenWidth / 2;
    const top = camY - screenHeight / 2;
    const bottom = camY + screenHeight / 2;

    const startX = Math.max(0, Math.floor(left / gridSpacing) * gridSpacing);
    const endX = Math.min(worldWidth, Math.ceil(right / gridSpacing) * gridSpacing);
    const startY = Math.max(0, Math.floor(top / gridSpacing) * gridSpacing);
    const endY = Math.min(worldHeight, Math.ceil(bottom / gridSpacing) * gridSpacing);

    for (let x = startX; x <= endX; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  private drawCell(cell: PlayerCell, name: string, color: string, isLocal: boolean): void {
    this.ctx.beginPath();
    this.ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);

    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.strokeStyle = this.adjustColorBrightness(color, -20);
    this.ctx.lineWidth = Math.max(2, cell.radius * 0.08);
    this.ctx.stroke();

    if (isLocal) {
      this.ctx.strokeStyle = "rgba(102, 252, 241, 0.4)";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    if (cell.radius > 12) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = `bold ${Math.max(12, cell.radius * 0.28)}px "Inter", system-ui, sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      this.ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
      this.ctx.lineWidth = Math.max(2, cell.radius * 0.06);
      this.ctx.strokeText(name, cell.x, cell.y);
      this.ctx.fillText(name, cell.x, cell.y);
    }
  }

  private adjustColorBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = ((num >> 8) & 0x00ff) + amt,
      B = (num & 0x0000ff) + amt;
    return (
      "#" +
      (
        0x1000000 +
        (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 0 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }
}
