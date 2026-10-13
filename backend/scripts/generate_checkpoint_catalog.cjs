const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const ts = require(path.join(root, "node_modules", "typescript"));
const source = fs.readFileSync(path.join(root, "src", "lib", "audit-data.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleObject = { exports: {} };
new Function("require", "module", "exports", output)(require, moduleObject, moduleObject.exports);

const checkpoints = moduleObject.exports.initialCheckpoints.map(
  ({ id, ref, name, category, ownerRole }) => ({ id, ref, name, category, ownerRole }),
);
if (checkpoints.length !== 85) {
  throw new Error(`Expected 85 checkpoints, got ${checkpoints.length}.`);
}

const target = path.join(root, "backend", "app", "data", "checkpoints.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(checkpoints, null, 2)}\n`, "utf8");
console.log(`Generated ${target} with ${checkpoints.length} checkpoints.`);
