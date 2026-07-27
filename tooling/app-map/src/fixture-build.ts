import { buildAppMap } from "./build";
import { readFixture } from "./test-fixtures";

const result = buildAppMap(readFixture("valid"));

if (result.ok) {
  process.stdout.write(result.json);
} else {
  process.stderr.write(`${JSON.stringify(result.diagnostics, null, 2)}\n`);
  process.exitCode = 1;
}
