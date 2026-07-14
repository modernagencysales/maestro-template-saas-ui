import {
  checkFrozenBrainFixtures,
  writeBrainEvalReport,
} from "./brain-eval-report";

const command = process.argv[2] ?? "eval";

if (command === "fixture-check") {
  const receipt = checkFrozenBrainFixtures();
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.passed) process.exitCode = 1;
} else if (command === "eval") {
  const out = process.argv[3] ?? "brain-eval-report.json";
  writeBrainEvalReport(out);
  console.log(`Wrote ${out}`);
} else {
  console.error(`Unknown brain eval command: ${command}`);
  process.exitCode = 1;
}
