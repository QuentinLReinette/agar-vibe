import { Circle, AABB } from "../src/physics/shapes.js";
import { checkCircleCircle, checkCircleBox } from "../src/physics/collision.js";
import { Vector2D } from "../src/math/vector2d.js";

describe("Collision System", () => {
  describe("Shape contains point", () => {
    test("Circle contains", () => {
      const circle = new Circle(0, 0, 10);
      expect(circle.contains(new Vector2D(5, 5))).toBe(true);
      expect(circle.contains(new Vector2D(10, 0))).toBe(true);
      expect(circle.contains(new Vector2D(11, 0))).toBe(false);
    });

    test("AABB contains", () => {
      const box = new AABB(0, 0, 10, 10);
      expect(box.contains(new Vector2D(5, 5))).toBe(true);
      expect(box.contains(new Vector2D(0, 0))).toBe(true);
      expect(box.contains(new Vector2D(10, 10))).toBe(true);
      expect(box.contains(new Vector2D(-1, 5))).toBe(false);
      expect(box.contains(new Vector2D(5, 11))).toBe(false);
    });
  });

  describe("checkCircleCircle", () => {
    test("overlapping circles", () => {
      const c1 = new Circle(0, 0, 5);
      const c2 = new Circle(3, 4, 5);
      expect(checkCircleCircle(c1, c2)).toBe(true);
    });

    test("touching circles", () => {
      const c1 = new Circle(0, 0, 3);
      const c2 = new Circle(5, 0, 2);
      expect(checkCircleCircle(c1, c2)).toBe(true);
    });

    test("separated circles", () => {
      const c1 = new Circle(0, 0, 3);
      const c2 = new Circle(6, 0, 2);
      expect(checkCircleCircle(c1, c2)).toBe(false);
    });
  });

  describe("checkCircleBox", () => {
    const box = new AABB(0, 0, 10, 10);

    test("circle inside box", () => {
      const circle = new Circle(5, 5, 2);
      expect(checkCircleBox(circle, box)).toBe(true);
    });

    test("circle intersecting box edge", () => {
      const circle = new Circle(-1, 5, 2);
      expect(checkCircleBox(circle, box)).toBe(true);
    });

    test("circle intersecting box corner", () => {
      const circle = new Circle(-1, -1, 2);
      expect(checkCircleBox(circle, box)).toBe(true);
    });

    test("circle outside box", () => {
      const circle = new Circle(-2, 5, 1.9);
      expect(checkCircleBox(circle, box)).toBe(false);
    });
  });
});
