// Walk ./lib, read every *.lua file, and emit public/lib/modules.json
// Usage:  node build-libs.js

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, parse, posix } from "path";

async function gather(dir, prefix = "") {
  const out = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(out, await gather(full, posix.join(prefix, entry.name)));
    } else if (entry.name.endsWith(".lua")) {
      const key  = posix.join(prefix, parse(entry.name).name); // a/b.lua → a/b
      const code = await readFile(full, "utf8");
      out[key] = code;
    }
  }
  return out;
}

const map = await gather("./lua");
await mkdir("./lib", { recursive: true });
await writeFile("./lib/modules.json", JSON.stringify(map));
console.log(`✅  modules.json written with ${Object.keys(map).length} modules`);
