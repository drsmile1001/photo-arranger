import { type SystemTime } from "./SystemTime";

export class SystemTimeReal implements SystemTime {
  now(): Date {
    return new Date();
  }
}
