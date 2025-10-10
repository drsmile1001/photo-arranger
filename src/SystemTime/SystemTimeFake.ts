import type { SystemTime } from "~shared/SystemTime";

export class SystemTimeFake implements SystemTime {
  private currentTime: number;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = initialTime.getTime();
  }

  now() {
    return new Date(this.currentTime);
  }

  advanceBy(milliseconds: number): void {
    this.currentTime += milliseconds;
  }

  setTime(newTime: Date): void {
    this.currentTime = newTime.getTime();
  }
}
