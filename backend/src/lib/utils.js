export function enumFromSchema(schema, path) {
  let current = schema;
  for (const key of path.split(".")) {
    current = current[key];
    if (!current) {
      throw new Error(`Path ${path} not found in schema`);
    }
  }
  if (!Array.isArray(current.enum)) {
    throw new Error(`Path ${path} does not contain an enum`);
  }
  return Object.freeze(
    current.enum.reduce((obj, val) => {
      obj[String(val).toUpperCase()] = val;
      return obj;
    }, {})
  );
}
