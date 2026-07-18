import {
  applyIntegrationWave,
  type ApplyIntegrationWaveMode,
} from "./apply-integration-wave.js";

const allowed = new Set([
  "--base",
  "--control-root",
  "--evidence",
  "--integration-id",
  "--mode",
  "--selection",
  "--selection-file-sha256",
  "--selection-payload-sha256",
  "--workdir",
]);

const values = new Map<string, string>();
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  if (!flag || !allowed.has(flag) || !value || value.startsWith("--")) {
    throw new Error("invalid deterministic integration apply arguments");
  }
  if (values.has(flag)) throw new Error(`duplicate argument ${flag}`);
  values.set(flag, value);
}
if (values.size !== allowed.size || args.length !== allowed.size * 2) {
  throw new Error(
    "usage: apply-integration-wave --workdir ... --control-root ... --evidence ... --selection ... --integration-id ... --base ... --selection-payload-sha256 ... --selection-file-sha256 ... --mode integrate|recover",
  );
}
const required = (flag: string): string => {
  const value = values.get(flag);
  if (!value) throw new Error(`missing argument ${flag}`);
  return value;
};
const mode = required("--mode");
if (mode !== "integrate" && mode !== "recover") {
  throw new Error("--mode must be integrate or recover");
}

const result = applyIntegrationWave({
  baseSha: required("--base"),
  controlRoot: required("--control-root"),
  evidenceDirectory: required("--evidence"),
  integrationId: required("--integration-id"),
  mode: mode as ApplyIntegrationWaveMode,
  selectionFileSha256: required("--selection-file-sha256"),
  selectionPath: required("--selection"),
  selectionPayloadSha256: required("--selection-payload-sha256"),
  workdir: required("--workdir"),
});
console.log(JSON.stringify(result));
