// Lets `node --experimental-strip-types` load the app's TypeScript modules:
// resolves the "@/" alias to src/ and extensionless relative imports to .ts.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !path.extname(spec)) {
    base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  }
  if (base) for (const ext of [".ts", "/index.ts"]) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}
