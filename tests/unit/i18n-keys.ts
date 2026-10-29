import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { STATUS_LABELS } from "../../src/lib/config";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

/** Every English string passed to t("...") in customer-facing code, plus status labels. */
export function collectKeys(): Set<string> {
  const keys = new Set<string>();
  const re = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  for (const file of walk(path.join(process.cwd(), "src"))) {
    if (file.includes(`${path.sep}admin${path.sep}`)) continue;
    for (const m of readFileSync(file, "utf8").matchAll(re)) {
      const lit = m[1];
      keys.add(lit.startsWith('"') ? JSON.parse(lit) : lit.slice(1, -1).replace(/\\'/g, "'"));
    }
  }
  Object.values(STATUS_LABELS).forEach((s) => keys.add(s));
  return keys;
}
