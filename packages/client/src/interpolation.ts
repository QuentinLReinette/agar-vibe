import { GameState, Player, PlayerCell } from "@agar-vibe/shared";

interface BufferedTick {
  state: GameState;
  timestamp: number;
}

export class StateInterpolation {
  private buffer: BufferedTick[] = [];
  private readonly maxBufferSize = 20;

  public addTick(state: GameState): void {
    this.buffer.push({
      state,
      timestamp: performance.now()
    });

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  public getInterpolatedState(interpolationDelay = 100): GameState | null {
    if (this.buffer.length === 0) return null;

    const renderTime = performance.now() - interpolationDelay;

    let p0: BufferedTick | null = null;
    let p1: BufferedTick | null = null;

    for (let i = 0; i < this.buffer.length; i++) {
      const tick = this.buffer[i];
      if (tick.timestamp <= renderTime) {
        p0 = tick;
      } else {
        p1 = tick;
        break;
      }
    }

    if (!p0) return this.buffer[0].state;
    if (!p1) return p0.state;

    const denom = p1.timestamp - p0.timestamp;
    const t = denom === 0 ? 0 : (renderTime - p0.timestamp) / denom;

    const interpolatedPlayers: Player[] = p0.state.players.map((player0) => {
      const player1 = p1!.state.players.find((p) => p.id === player0.id);
      if (!player1) return player0;

      const interpolatedCells: PlayerCell[] = player0.cells.map((cell0) => {
        const cell1 = player1.cells.find((c) => c.id === cell0.id);
        if (!cell1) return cell0;

        return {
          ...cell0,
          x: cell0.x + (cell1.x - cell0.x) * t,
          y: cell0.y + (cell1.y - cell0.y) * t,
          radius: cell0.radius + (cell1.radius - cell0.radius) * t
        };
      });

      return {
        ...player0,
        cells: interpolatedCells,
        score: player1.score
      };
    });

    return {
      width: p0.state.width,
      height: p0.state.height,
      players: interpolatedPlayers,
      food: p0.state.food
    };
  }
}
