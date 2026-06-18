import { Circle, AABB } from "./shapes.js";

export function checkCircleCircle(c1: Circle, c2: Circle): boolean {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distanceSquared <= radiusSum * radiusSum;
}

export function checkCircleBox(circle: Circle, box: AABB): boolean {
  const closestX = Math.max(box.x, Math.min(circle.x, box.x + box.width));
  const closestY = Math.max(box.y, Math.min(circle.y, box.y + box.height));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSquared = dx * dx + dy * dy;

  return distanceSquared <= circle.radius * circle.radius;
}
