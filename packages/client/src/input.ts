export class InputManager {
  private angle = 0;
  private speed = 0;
  private isActive = false;

  constructor() {
    window.addEventListener("mousemove", this.handleMouseMove.bind(this));
  }

  public start(): void {
    this.isActive = true;
    this.speed = 1;
  }

  public stop(): void {
    this.isActive = false;
    this.speed = 0;
  }

  public getInput(): { angle: number; speed: number } {
    return { angle: this.angle, speed: this.speed };
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isActive) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    this.angle = Math.atan2(dy, dx);
  }
}
