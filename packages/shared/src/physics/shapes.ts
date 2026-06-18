import { Vector2D } from "../math/vector2d.js";

export interface Shape {
  contains(point: Vector2D): boolean;
}

export class Circle implements Shape {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly radius: number
  ) {}

  contains(point: Vector2D): boolean {
    const dx = this.x - point.x;
    const dy = this.y - point.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }
}

export class AABB implements Shape {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly width: number,
    public readonly height: number
  ) {}

  contains(point: Vector2D): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.x + this.width &&
      point.y >= this.y &&
      point.y <= this.y + this.height
    );
  }
}
