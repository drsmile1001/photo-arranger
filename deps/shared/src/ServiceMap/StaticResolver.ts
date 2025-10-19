import type { ServiceResolver } from "./ServiceContainer";
import type { ServiceMap } from "./ServiceMap";

export class StaticResolver<T extends ServiceMap>
  implements ServiceResolver<T>
{
  constructor(private readonly map: T) {}

  resolve<K extends keyof T>(key: K): T[K] {
    return this.map[key];
  }

  toMap(): T {
    return this.map;
  }
}
