import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const baseline = resolve(import.meta.dirname, "../docs/original-files.json");
async function digest(dir) {
  const files = await readdir(dir, { withFileTypes: true, recursive: true });
  const hash = createHash("sha256");
  let count = 0;
  for (const file of files.filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name)).sort()) {
    hash.update(relative(dir, file)); hash.update(await readFile(file)); count++;
  }
  return { count, sha256: hash.digest("hex") };
}
const actual = {};
for (const name of ["demo", "demo-intro"]) actual[name] = await digest(resolve(root, name, "src/main/resources/static"));
if (process.argv.includes("--record")) {
  await writeFile(baseline, JSON.stringify(actual, null, 2) + "\n");
  console.log("Original baseline recorded", actual);
} else {
  const expected = JSON.parse(await readFile(baseline, "utf8"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Original game files changed.");
  console.log("Both original static source trees unchanged.", actual);
}
