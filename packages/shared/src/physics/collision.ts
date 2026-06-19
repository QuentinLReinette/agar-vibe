export function checkCircleCircle(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = r1 + r2;
  return distanceSquared <= radiusSum * radiusSum;
}
