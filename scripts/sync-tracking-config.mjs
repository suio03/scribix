import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

// Usage: node scripts/sync-tracking-config.mjs /path/to/tracking/projects.json [--write]
const target = process.argv[2];
if (!target) throw new Error("Provide the tracking projects.json path");
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = ts.createSourceFile("analytics.ts", read("lib/analytics.ts"), ts.ScriptTarget.Latest, true);
const alias = source.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "PlausibleEvents");
const events = alias.type.types.flatMap(type => ts.isTypeLiteralNode(type)
  ? type.members.map(member => member.name.text) : []);
const contract = ts.createSourceFile("contract.ts", read("lib/video-workspace/analytics-contract.ts"), ts.ScriptTarget.Latest, true);
for (const statement of contract.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(contract) === "VIDEO_ANALYTICS_EVENTS") {
      events.push(...declaration.initializer.expression.elements.map(element => element.text));
    }
  }
}
const config = JSON.parse(readFileSync(target, "utf8"));
const plausible = config.projects.scribix.plausible;
const missing = events.filter(event => !plausible.goals.includes(event));
if (process.argv.includes("--write")) {
  plausible.goals.push(...missing);
  // Keep historical goals and existing funnels/breakdowns comparable.
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Added ${missing.length} Scribix goals; preserved historical configuration.`);
} else {
  console.log(JSON.stringify({ expected: events.length, missing }, null, 2));
  if (missing.length) process.exitCode = 1;
}
