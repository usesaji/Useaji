// Compares what the app calls with what the Railway API has (docs/openapi.json):
//   - every route the mock serves (src/mocks/handlers/*.ts, `route("GET", "/groups/:id", …)`), and
//   - every path the feature api.ts files call (`apiGet("/groups/${id}")`),
// against the spec's paths. Prints routes the API lacks (gaps), and API routes the app doesn't use.
// `pnpm --filter web check:api`. Exits 1 when the app calls a route the spec doesn't have, unless
// the mock marks it `notInApi` (a known, documented gap).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const spec = JSON.parse(fs.readFileSync(path.resolve(web, "../../docs/openapi.json"), "utf8"));

// Template params (`${id}`) first, then spec params (`{id}`) and mock params (`:id`).
const norm = (p) => p.replace(/^\/v1/, "").replace(/\$\{[^}]+\}/g, ":x").replace(/\{[^}]+\}/g, ":x").replace(/:\w+/g, ":x");
const specRoutes = new Map();
for (const [p, ops] of Object.entries(spec.paths)) {
	for (const method of Object.keys(ops)) specRoutes.set(`${method.toUpperCase()} ${norm(p)}`, `${method.toUpperCase()} ${p}`);
}

const files = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// Mock routes, with their `notInApi` reason.
const mock = new Map();
for (const file of files(path.join(web, "src/mocks/handlers"))) {
	const src = fs.readFileSync(file, "utf8");
	for (const m of src.matchAll(/route\(\s*"(\w+)",\s*"([^"]+)",\s*\{([\s\S]*?)\}\s*,/g)) {
		const notInApi = /notInApi:\s*"([^"]+)"/.exec(m[3])?.[1];
		mock.set(`${m[1]} ${norm(m[2])}`, { path: m[2], notInApi });
	}
}

// Calls in the feature api.ts files.
const METHOD = { apiGet: "GET", apiPost: "POST", apiPut: "PUT", apiPatch: "PATCH", apiDelete: "DELETE" };
const calls = new Map();
for (const file of [...files(path.join(web, "src/features")).filter((f) => f.endsWith("api.ts")), path.join(web, "src/lib/api/client.ts")]) {
	const src = fs.readFileSync(file, "utf8");
	// `[^(]*` skips type arguments, nested ones included (`apiGet<Page<GroupSummaryDto>>(`).
	for (const m of src.matchAll(/\b(apiGet|apiPost|apiPut|apiPatch|apiDelete)\b[^(]*\(\s*[`"]([^`"]+)[`"]/g)) {
		calls.set(`${METHOD[m[1]]} ${norm(m[2])}`, path.relative(web, file));
	}
	for (const m of src.matchAll(/\bapiForm\b[^(]*\(\s*"(\w+)",\s*[`"]([^`"]+)[`"]/g)) {
		calls.set(`${m[1].toUpperCase()} ${norm(m[2])}`, path.relative(web, file));
	}
}

let unexpected = 0;
console.log("App calls the API doesn't have:");
for (const [key, file] of calls) {
	if (specRoutes.has(key)) continue;
	const known = mock.get(key)?.notInApi;
	if (!known) unexpected++;
	console.log(`  ${known ? "known gap" : "UNEXPECTED"}  ${key}  (${file})${known ? `\n      ${known}` : ""}`);
}
for (const key of mock.keys()) if (!calls.has(key) && !specRoutes.has(key)) console.log(`  mock only (unused)  ${key}`);

console.log("\nAPI routes the app doesn't call:");
for (const [key, original] of specRoutes) if (!calls.has(key)) console.log(`  ${original}`);

console.log("\nAPI routes the mock doesn't serve:");
for (const [key, original] of specRoutes) if (!mock.has(key)) console.log(`  ${original}`);

console.log(`\n${calls.size} app calls · ${specRoutes.size} API routes · ${unexpected} unexpected`);
process.exit(unexpected ? 1 : 0);
