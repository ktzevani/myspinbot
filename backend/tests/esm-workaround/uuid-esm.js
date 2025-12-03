import { createRequire } from "module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const uuidPath = fileURLToPath(
  new URL("../../node_modules/uuid/dist/index.js", import.meta.url)
);
const uuid = require(uuidPath);

export const {
  v1,
  v1ToV6,
  v3,
  v4,
  v5,
  v6,
  v6ToV1,
  v7,
  NIL,
  MAX,
  version,
  validate,
  stringify,
  parse,
} = uuid;
