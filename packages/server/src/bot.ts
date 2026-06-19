import { PlayerCell, Food, Player, SpatialGrid } from "@agar-vibe/shared";
import { GameEngine } from "./game.js";

export class BotManager {
  private readonly targetBotCount = 20;
  private botIdCounter = 10000;
  private botIds: Set<string> = new Set();

  private readonly botNames = [
    "Marvin",
    "Bender",
    "GlaDOS",
    "HAL 9000",
    "R2-D2",
    "C-3PO",
    "WALL-E",
    "T-800",
    "Optimus",
    "Megatron",
    "Robocop",
    "Data",
    "Jarvis",
    "Ultron",
    "Bishop",
    "Ash",
    "Gort",
    "Clank",
    "Baymax",
    "KITT",
    "TARS",
    "CASE",
    "Sunny",
    "Doc Brown",
    "Terminator",
    "Skynet"
  ];

  public getBotIds(): Set<string> {
    return this.botIds;
  }

  public update(engine: GameEngine): void {
    this.maintainBotCount(engine);

    const players = engine.getPlayers();
    for (const [id, player] of players.entries()) {
      if (this.botIds.has(id)) {
        this.updateSingleBot(id, player, engine);
      }
    }
  }

  private maintainBotCount(engine: GameEngine): void {
    while (this.botIds.size < this.targetBotCount) {
      this.spawnBot(engine);
    }
  }

  private updateSingleBot(id: string, player: Player, engine: GameEngine): void {
    const cell = player.cells[0];
    if (!cell) return;

    // 1. Flee
    const threat = this.findClosestThreat(id, cell, engine.getPlayers());
    if (threat) {
      const noise = (Math.random() - 0.5) * 0.05;
      const angle = Math.atan2(cell.y - threat.y, cell.x - threat.x) + noise;
      engine.updateInput(id, angle, 1.0);
      return;
    }

    // 2. Hunt
    const prey = this.findClosestPrey(id, cell, engine.getPlayers());
    if (prey) {
      const noise = (Math.random() - 0.5) * 0.05;
      const angle = Math.atan2(prey.y - cell.y, prey.x - cell.x) + noise;
      engine.updateInput(id, angle, 1.0);
      return;
    }

    // 3. Feed
    const food = this.findClosestFood(cell, engine.getFoodGrid());
    if (food) {
      const noise = (Math.random() - 0.5) * 0.1;
      const angle = Math.atan2(food.y - cell.y, food.x - cell.x) + noise;
      engine.updateInput(id, angle, 1.0);
      return;
    }

    // 4. Wander
    const currentInput = engine.getPlayerInputs().get(id);
    const currentAngle = currentInput ? currentInput.angle : Math.random() * Math.PI * 2;
    const newAngle = currentAngle + (Math.random() - 0.5) * 0.4;
    engine.updateInput(id, newAngle, 0.7);
  }

  private findClosestThreat(
    botId: string,
    cell: PlayerCell,
    players: Map<string, Player>
  ): PlayerCell | null {
    let closestThreat: PlayerCell | null = null;
    let closestThreatDistSq = Infinity;

    for (const otherPlayer of players.values()) {
      if (otherPlayer.id === botId) continue;
      for (const otherCell of otherPlayer.cells) {
        if (otherCell.mass > cell.mass * 1.1) {
          const dx = otherCell.x - cell.x;
          const dy = otherCell.y - cell.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 300 * 300 && distSq < closestThreatDistSq) {
            closestThreat = otherCell;
            closestThreatDistSq = distSq;
          }
        }
      }
    }
    return closestThreat;
  }

  private findClosestPrey(
    botId: string,
    cell: PlayerCell,
    players: Map<string, Player>
  ): PlayerCell | null {
    let closestPrey: PlayerCell | null = null;
    let closestPreyDistSq = Infinity;

    for (const otherPlayer of players.values()) {
      if (otherPlayer.id === botId) continue;
      for (const otherCell of otherPlayer.cells) {
        if (cell.mass > otherCell.mass * 1.1) {
          const dx = otherCell.x - cell.x;
          const dy = otherCell.y - cell.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 200 * 200 && distSq < closestPreyDistSq) {
            closestPrey = otherCell;
            closestPreyDistSq = distSq;
          }
        }
      }
    }
    return closestPrey;
  }

  private findClosestFood(cell: PlayerCell, foodGrid: SpatialGrid<Food>): Food | null {
    const minX = cell.x - 250;
    const maxX = cell.x + 250;
    const minY = cell.y - 250;
    const maxY = cell.y + 250;
    const foodCandidates = foodGrid.query(minX, minY, maxX, maxY);

    let closestFood: Food | null = null;
    let closestFoodDistSq = Infinity;

    for (const foodItem of foodCandidates) {
      const dx = foodItem.x - cell.x;
      const dy = foodItem.y - cell.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestFoodDistSq) {
        closestFood = foodItem;
        closestFoodDistSq = distSq;
      }
    }
    return closestFood;
  }

  private spawnBot(engine: GameEngine): void {
    const botId = (this.botIdCounter++).toString();

    // Collect all active names on the field
    const activeNames = new Set<string>();
    for (const player of engine.getPlayers().values()) {
      activeNames.add(player.name);
    }

    // Filter available bot names to prevent duplicates
    const availableNames = this.botNames.filter((name) => !activeNames.has(name));

    let name: string;
    if (availableNames.length > 0) {
      name = availableNames[Math.floor(Math.random() * availableNames.length)];
    } else {
      name = `Bot-${botId}`;
    }

    this.botIds.add(botId);
    engine.addPlayer(botId, name);
  }
}
