import { checkCircleCircle, SpatialGrid } from "@agar-vibe/shared";
import { Player, PlayerCell, Food, GameState } from "@agar-vibe/shared";

const COLORS = [
  "#ff5722", // orange
  "#e91e63", // pink
  "#9c27b0", // purple
  "#3f51b5", // indigo
  "#00bcd4", // cyan
  "#4caf50", // green
  "#ffeb3b", // yellow
  "#ff9800", // amber
  "#009688", // teal
  "#673ab7" // deep purple
];

export class GameEngine {
  public readonly width = 4000;
  public readonly height = 4000;

  private players: Map<string, Player> = new Map();
  private food: Food[] = [];
  private foodGrid: SpatialGrid<Food> = new SpatialGrid<Food>(200);

  private readonly maxFood = 400;
  private readonly baseSpeed = 300;

  // Track inputs for each player: { id: { angle, speed } }
  private playerInputs: Map<string, { angle: number; speed: number }> = new Map();

  constructor() {
    this.spawnInitialFood();
  }

  public addPlayer(id: string, name: string): Player {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    // Spawn at random position with safety padding
    const startX = 200 + Math.random() * (this.width - 400);
    const startY = 200 + Math.random() * (this.height - 400);

    const initialMass = 10;
    const initialRadius = this.calculateRadius(initialMass);

    const cell: PlayerCell = {
      id: `${id}-cell-0`,
      x: startX,
      y: startY,
      radius: initialRadius,
      mass: initialMass
    };

    const player: Player = {
      id,
      name: name || `Guest-${Math.floor(1000 + Math.random() * 9000)}`,
      cells: [cell],
      score: initialMass,
      color
    };

    this.players.set(id, player);
    this.playerInputs.set(id, { angle: 0, speed: 0 });

    return player;
  }

  public removePlayer(id: string): void {
    this.players.delete(id);
    this.playerInputs.delete(id);
  }

  public updateInput(id: string, angle: number, speed: number): void {
    const input = this.playerInputs.get(id);
    if (input) {
      input.angle = angle;
      // Clamp speed factor between 0 and 1
      input.speed = Math.max(0, Math.min(1, speed));
    }
  }

  public tick(dt: number): void {
    this.movePlayers(dt);
    this.checkCollisions();
    this.maintainFoodDensity();
  }

  public getSerializedState(): GameState {
    return {
      width: this.width,
      height: this.height,
      players: Array.from(this.players.values()),
      food: this.food
    };
  }

  private calculateRadius(mass: number): number {
    // Standard Agar.io cell radius growth curve
    return 4 + Math.sqrt(mass) * 6;
  }

  private spawnInitialFood(): void {
    for (let i = 0; i < this.maxFood; i++) {
      const item = this.createRandomFood();
      this.food.push(item);
      this.foodGrid.insert(item);
    }
  }

  private createRandomFood(): Food {
    const radius = 6;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;

    return {
      id: `food-${Math.random().toString(36).substring(2, 9)}`,
      x,
      y,
      radius,
      color
    };
  }

  private maintainFoodDensity(): void {
    while (this.food.length < this.maxFood) {
      const item = this.createRandomFood();
      this.food.push(item);
      this.foodGrid.insert(item);
    }
  }

  private movePlayers(dt: number): void {
    for (const [id, player] of this.players.entries()) {
      const input = this.playerInputs.get(id);
      if (!input || input.speed === 0) continue;

      for (const cell of player.cells) {
        // Speed is inversely proportional to cell mass
        const speedModifier = this.baseSpeed / Math.sqrt(cell.mass);
        const velocity = speedModifier * input.speed;

        cell.x += Math.cos(input.angle) * velocity * dt;
        cell.y += Math.sin(input.angle) * velocity * dt;

        // Clamp inside world bounds with padding for radius
        cell.x = Math.max(cell.radius, Math.min(this.width - cell.radius, cell.x));
        cell.y = Math.max(cell.radius, Math.min(this.height - cell.radius, cell.y));
      }
    }
  }

  private checkCollisions(): void {
    // 1. Cell vs Food
    for (const player of this.players.values()) {
      for (const cell of player.cells) {
        const minX = cell.x - cell.radius;
        const maxX = cell.x + cell.radius;
        const minY = cell.y - cell.radius;
        const maxY = cell.y + cell.radius;

        const candidates = this.foodGrid.query(minX, minY, maxX, maxY);
        for (const foodItem of candidates) {
          if (
            checkCircleCircle(cell.x, cell.y, cell.radius, foodItem.x, foodItem.y, foodItem.radius)
          ) {
            if (this.foodGrid.remove(foodItem)) {
              // Eat food: increase cell mass and score
              cell.mass += 1;
              player.score = this.calculateTotalScore(player);
              cell.radius = this.calculateRadius(cell.mass);
              // Remove from food list
              const idx = this.food.findIndex((f) => f.id === foodItem.id);
              if (idx !== -1) {
                this.food.splice(idx, 1);
              }
            }
          }
        }
      }
    }

    // 2. Cell vs Cell (Eating other players)
    const allPlayers = Array.from(this.players.values());
    for (const player of allPlayers) {
      for (const cell of player.cells) {
        // Check this cell against every cell of other players
        for (const otherPlayer of allPlayers) {
          if (player.id === otherPlayer.id) continue;

          otherPlayer.cells = otherPlayer.cells.filter((otherCell) => {
            // Distance check
            const dx = cell.x - otherCell.x;
            const dy = cell.y - otherCell.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Eat condition:
            // 1. Current cell is 10% larger than other cell in mass
            // 2. Center of smaller cell is within larger cell's circle (dist < radius)
            if (cell.mass > otherCell.mass * 1.1 && dist < cell.radius) {
              cell.mass += otherCell.mass;
              cell.radius = this.calculateRadius(cell.mass);
              player.score = this.calculateTotalScore(player);
              return false; // remove other cell (it got eaten)
            }
            return true; // keep
          });
        }
      }
    }

    // Remove players with no cells left
    for (const [id, player] of this.players.entries()) {
      if (player.cells.length === 0) {
        this.removePlayer(id);
      }
    }
  }

  private calculateTotalScore(player: Player): number {
    return player.cells.reduce((total, cell) => total + cell.mass, 0);
  }
}
