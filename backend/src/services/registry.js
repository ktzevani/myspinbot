import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getCapabilities } from "../config.js";

const __planeCapabilities = getCapabilities();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function factory() {
  const registry = new Map();
  for (const cap of __planeCapabilities.capabilities) {
    const file = path.join(__dirname, cap.handler.module.split("/")[1]);
    const moduleUrl = pathToFileURL(file).href;
    const mod = await import(moduleUrl);
    const entry = Object.entries(mod).filter(
      ([exportName, value]) =>
        exportName === cap.handler.method && typeof value === "function",
    );
    if (entry.length == 1) {
      registry.set(cap.id, entry[0][1]);
    }
  }

  return registry;
}

export const servicesRegistry = await factory();
export default servicesRegistry;
