import { createRequire } from "module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ansiPath = fileURLToPath(
  new URL("../../node_modules/ansi-styles/index.js", import.meta.url)
);
const ansi = require(ansiPath);

export default ansi;
export const { color, modifier, bgColor } = ansi;
