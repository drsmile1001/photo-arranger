import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import type { Logger } from "~shared/Logger";

export function expandHome(p: string) {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export async function confirm(logger: Logger, question: string) {
  const rl = createInterface({ input, output });
  const ans = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

export async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
