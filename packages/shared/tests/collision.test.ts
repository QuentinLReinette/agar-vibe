import { checkCircleCircle } from "../src/physics/collision.js";

describe("Collision System", () => {
  describe("checkCircleCircle", () => {
    test("overlapping circles", () => {
      expect(checkCircleCircle(0, 0, 5, 3, 4, 5)).toBe(true);
    });

    test("touching circles", () => {
      expect(checkCircleCircle(0, 0, 3, 5, 0, 2)).toBe(true);
    });

    test("separated circles", () => {
      expect(checkCircleCircle(0, 0, 3, 6, 0, 2)).toBe(false);
    });
  });
});
