export class SpatialGrid<T extends { id: string | number; x: number; y: number }> {
  private buckets: Map<string, T[]> = new Map();

  constructor(public readonly cellSize: number = 200) {}

  private getBucketKey(x: number, y: number): string {
    const bx = Math.floor(x / this.cellSize);
    const by = Math.floor(y / this.cellSize);
    return `${bx},${by}`;
  }

  public clear(): void {
    this.buckets.clear();
  }

  public insert(item: T): void {
    const key = this.getBucketKey(item.x, item.y);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(item);
  }

  public remove(item: T): boolean {
    const key = this.getBucketKey(item.x, item.y);
    const bucket = this.buckets.get(key);
    if (!bucket) return false;
    const index = bucket.findIndex((val) => val.id === item.id);
    if (index !== -1) {
      bucket.splice(index, 1);
      if (bucket.length === 0) {
        this.buckets.delete(key);
      }
      return true;
    }
    return false;
  }

  public update(item: T, oldX: number, oldY: number): void {
    const oldKey = this.getBucketKey(oldX, oldY);
    const newKey = this.getBucketKey(item.x, item.y);
    if (oldKey === newKey) return;

    // Remove from old
    const oldBucket = this.buckets.get(oldKey);
    if (oldBucket) {
      const idx = oldBucket.findIndex((val) => val.id === item.id);
      if (idx !== -1) {
        oldBucket.splice(idx, 1);
        if (oldBucket.length === 0) this.buckets.delete(oldKey);
      }
    }

    // Insert into new
    let newBucket = this.buckets.get(newKey);
    if (!newBucket) {
      newBucket = [];
      this.buckets.set(newKey, newBucket);
    }
    newBucket.push(item);
  }

  public query(minX: number, minY: number, maxX: number, maxY: number): T[] {
    const items: T[] = [];
    const minBx = Math.floor(minX / this.cellSize);
    const maxBx = Math.floor(maxX / this.cellSize);
    const minBy = Math.floor(minY / this.cellSize);
    const maxBy = Math.floor(maxY / this.cellSize);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        const key = `${bx},${by}`;
        const bucket = this.buckets.get(key);
        if (bucket) {
          items.push(...bucket);
        }
      }
    }
    return items;
  }
}
