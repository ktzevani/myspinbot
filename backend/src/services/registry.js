import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function factory() {
  const files = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".js") && file !== "registry.js");

  const allEntries = await Promise.all(
    files.map(async (file) => {
      const moduleUrl = pathToFileURL(path.join(__dirname, file)).href;
      const mod = await import(moduleUrl);
      const moduleName = path.basename(file, ".js");

      return Object.entries(mod)
        .filter(
          ([exportName, value]) =>
            exportName !== "default" && typeof value === "function"
        )
        .map(([exportName, fn]) => [`${moduleName}.${exportName}`, fn]);
    })
  );

  const registry = new Map();
  for (const entries of allEntries) {
    for (const [key, fn] of entries) {
      registry.set(key, fn);
    }
  }
  return registry;
}

export const servicesRegistry = await factory();
export default servicesRegistry;
