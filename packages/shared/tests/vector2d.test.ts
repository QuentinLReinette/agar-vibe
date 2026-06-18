import { Vector2D } from "../src/math/vector2d.js";

describe("Vector2D", () => {
  test("instantiation", () => {
    const v = new Vector2D(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  test("add", () => {
    const v1 = new Vector2D(1, 2);
    const v2 = new Vector2D(3, 4);
    const result = v1.add(v2);
    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  test("sub", () => {
    const v1 = new Vector2D(5, 7);
    const v2 = new Vector2D(2, 3);
    const result = v1.sub(v2);
    expect(result.x).toBe(3);
    expect(result.y).toBe(4);
  });

  test("scale", () => {
    const v = new Vector2D(2, 3);
    const result = v.scale(3);
    expect(result.x).toBe(6);
    expect(result.y).toBe(9);
  });

  test("magnitude", () => {
    const v = new Vector2D(3, 4);
    expect(v.magnitude()).toBe(5);
  });

  test("normalize", () => {
    const v = new Vector2D(3, 0);
    const norm = v.normalize();
    expect(norm.x).toBe(1);
    expect(norm.y).toBe(0);

    const zero = new Vector2D(0, 0);
    expect(zero.normalize().x).toBe(0);
    expect(zero.normalize().y).toBe(0);
  });

  test("distance", () => {
    const v1 = new Vector2D(1, 1);
    const v2 = new Vector2D(4, 5);
    expect(v1.distance(v2)).toBe(5);
  });

  test("dot product", () => {
    const v1 = new Vector2D(1, 2);
    const v2 = new Vector2D(3, 4);
    expect(v1.dot(v2)).toBe(11);
  });
});
