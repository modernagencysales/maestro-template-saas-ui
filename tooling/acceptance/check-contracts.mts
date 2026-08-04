import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { isDirectRun } from "../quality/src/direct-run.mts";
import {
  compileContractInventory,
  assertNoAdmittedActivationOwnedSurfaces,
  renderAdmittedJourneys,
} from "./contract-inventory";
import type { PublicSurface } from "../../packages/template-core/src/publicSurface";
import {
  createProtectedControllerHttpAdapter,
  observeSecurityCodeownerApproval,
} from "../ci/protected-bootstrap.mts";

export const CUCUMBER_CONFIGURATION_SOURCE = `module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};
`;

export type CheckedCucumberConfiguration = {
  readonly requireModule: readonly ["tsx/cjs"];
  readonly require: readonly [
    "features/support/**/*.ts",
    "features/step_definitions/**/*.ts",
  ];
  readonly retry: 0;
  readonly parallel: 0;
};

const checkedConfiguration: CheckedCucumberConfiguration = {
  requireModule: ["tsx/cjs"],
  require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
  retry: 0,
  parallel: 0,
};

export function validateCucumberConfigurationSource(
  source: string,
):
  | { readonly ok: true; readonly value: CheckedCucumberConfiguration }
  | { readonly ok: false; readonly findings: readonly string[] } {
  if (source === CUCUMBER_CONFIGURATION_SOURCE) {
    return { ok: true, value: checkedConfiguration };
  }
  return {
    ok: false,
    findings: [
      `cucumber.cjs must byte-match the protected four-key profile; received:\n${source}`,
    ],
  };
}

/** Cucumber treats an argument beginning with `@` as a rerun file, never a Feature. */
export const resolveSelectedFeaturePaths = (
  root: string,
  paths: readonly string[],
): readonly string[] =>
  paths.map((path) => {
    if (
      !path.startsWith("features/") ||
      !path.endsWith(".feature") ||
      path.includes("\\") ||
      path
        .split("/")
        .some((part) => part === "" || part === "." || part === "..")
    )
      throw new Error(`selected Feature path is not canonical: ${path}`);
    if (path.slice(path.lastIndexOf("/") + 1).startsWith("@"))
      throw new Error(
        `selected Feature path is a Cucumber rerun-file argument: ${path}`,
      );
    const resolved = resolve(root, path);
    if (relative(resolve(root), resolved).startsWith(".."))
      throw new Error(`selected Feature path escapes controller root: ${path}`);
    return resolved;
  });

const expectedVersions = {
  "@cucumber/cucumber": "13.2.0",
  "@cucumber/gherkin": "41.0.0",
  "@cucumber/messages": "34.0.1",
} as const;

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
type DependencySection = (typeof dependencySections)[number];

const dependencyVersion = (
  manifest: unknown,
  section: DependencySection,
  name: string,
): unknown => {
  if (typeof manifest !== "object" || manifest === null) return undefined;
  const dependencies = (manifest as Record<string, unknown>)[section];
  if (typeof dependencies !== "object" || dependencies === null)
    return undefined;
  return (dependencies as Record<string, unknown>)[name];
};

export function validateCucumberPackageVersions(
  rootManifest: unknown,
  templateCoreManifest: unknown,
):
  | { readonly ok: true; readonly versions: typeof expectedVersions }
  | { readonly ok: false; readonly findings: readonly string[] } {
  const manifests = {
    root: rootManifest,
    "template-core": templateCoreManifest,
  };
  const owners = [
    ["@cucumber/cucumber", "root", "devDependencies"],
    ["@cucumber/gherkin", "template-core", "dependencies"],
    ["@cucumber/messages", "template-core", "dependencies"],
  ] as const;
  const findings: string[] = [];
  for (const [name, owningManifest, owningSection] of owners) {
    const expected = expectedVersions[name];
    const actual = dependencyVersion(
      manifests[owningManifest],
      owningSection,
      name,
    );
    if (actual !== expected) {
      findings.push(
        `${name} must be pinned as ${expected} in ${owningManifest}.${owningSection}; received ${String(actual)}`,
      );
    }
    for (const [manifestName, manifest] of Object.entries(manifests)) {
      for (const section of dependencySections) {
        if (manifestName === owningManifest && section === owningSection)
          continue;
        const misplaced = dependencyVersion(manifest, section, name);
        if (misplaced !== undefined) {
          findings.push(
            `${manifestName}.${section}.${name} must be absent; received ${String(misplaced)}`,
          );
        }
      }
    }
  }
  return findings.length === 0
    ? { ok: true, versions: expectedVersions }
    : { ok: false, findings };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--write") || args.length > 1)
    throw new Error(`unsupported check-contracts arguments: ${args.join(" ")}`);
  const write = args[0] === "--write";
  const [source, rootSource, templateCoreSource] = await Promise.all([
    readFile(resolve("cucumber.cjs"), "utf8"),
    readFile(resolve("package.json"), "utf8"),
    readFile(resolve("packages/template-core/package.json"), "utf8"),
  ]);
  const configuration = validateCucumberConfigurationSource(source);
  const versions = validateCucumberPackageVersions(
    JSON.parse(rootSource),
    JSON.parse(templateCoreSource),
  );
  const findings = [
    ...(configuration.ok ? [] : configuration.findings),
    ...(versions.ok ? [] : versions.findings),
  ];
  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
    return;
  }
  const run = resolveAcceptanceRun(process.cwd());
  await verifyProtectedBaseFixture(process.cwd(), run.protectedBaseSha);
  const inventory = compileContractInventory(run);
  if (inventory.authPolicyDeltas.length > 0) {
    const candidateCommit = process.env.PROTECTED_CANDIDATE_COMMIT;
    const pullRequestNumber = Number(process.env.PROTECTED_PR_NUMBER);
    if (
      candidateCommit === undefined ||
      !Number.isSafeInteger(pullRequestNumber)
    )
      throw new Error(
        "auth-policy weakening requires controller-provided candidate commit and pull request number",
      );
    const approval = await observeSecurityCodeownerApproval({
      repository: process.env.PROTECTED_REPOSITORY ?? "",
      pullRequestNumber,
      candidateCommit,
      api: createProtectedControllerHttpAdapter(),
    });
    if (approval.candidateCommit !== candidateCommit)
      throw new Error(
        "security approval is not bound to the current candidate commit",
      );
  }
  const projection = await synchronizeAdmittedJourneys({
    root: process.cwd(),
    write,
    inventory,
  });
  console.log(
    `Cucumber contracts OK: ${Object.entries(versions.versions)
      .map(([name, version]) => `${name}@${version}`)
      .join(
        ", ",
      )}; keys=${Object.keys(configuration.value).join(",")}; require=${configuration.value.require.join(",")}; status=${projection.status}; admittedPickles=${projection.admittedPickles}`,
  );
}

export const synchronizeAdmittedJourneys = async (input: {
  readonly root: string;
  readonly write: boolean;
  readonly inventory?: ReturnType<typeof compileContractInventory>;
}): Promise<{
  readonly status: "contracts-present" | "no-admitted-contracts";
  readonly admittedPickles: number;
  readonly wrote: boolean;
}> => {
  const inventory =
    input.inventory ??
    compileContractInventory({
      root: input.root,
      protectedBaseSha: "",
      mode: "static",
    });
  const expected = renderAdmittedJourneys(inventory);
  if (inventory.admittedPickleKeys.length === 0) {
    const surfaces = JSON.parse(
      await readFile(
        resolve(
          input.root,
          "packages/template-core/src/generated/public-surfaces.generated.json",
        ),
        "utf8",
      ),
    ) as { readonly surfaces?: unknown };
    if (!Array.isArray(surfaces.surfaces))
      throw new Error(
        "no-admitted projection cannot verify registration inventory",
      );
    const expectedRegistrations = (
      surfaces.surfaces as readonly PublicSurface[]
    )
      .filter((surface) => surface.activationJourneyId !== undefined)
      .map((surface) => ({
        surfaceId: surface.id,
        journeyId: surface.activationJourneyId,
        transport: surface.transport,
        registrationLocator: surface.authority.registrationLocator,
      }))
      .sort((left, right) => left.surfaceId.localeCompare(right.surfaceId));
    let manifest: unknown;
    try {
      manifest = JSON.parse(
        await readFile(
          resolve(
            input.root,
            "packages/template-core/src/generated/activation-registration-manifest.json",
          ),
          "utf8",
        ),
      );
    } catch {
      throw new Error(
        "no-admitted projection cannot verify registration inventory",
      );
    }
    if (
      typeof manifest !== "object" ||
      manifest === null ||
      (manifest as { schemaVersion?: unknown }).schemaVersion !== 1 ||
      !Array.isArray((manifest as { registrations?: unknown }).registrations) ||
      JSON.stringify((manifest as { registrations: unknown }).registrations) !==
        JSON.stringify(expectedRegistrations)
    )
      throw new Error("activation registration inventory drift");
    assertNoAdmittedActivationOwnedSurfaces(
      inventory.journeys,
      surfaces.surfaces as readonly PublicSurface[],
    );
  }
  const path = resolve(
    input.root,
    "packages/template-core/src/generated/admittedJourneys.ts",
  );
  if (input.write) await writeFile(path, expected, "utf8");
  else {
    let actual: string;
    try {
      actual = await readFile(path, "utf8");
    } catch {
      throw new Error(`admitted journey projection drift: ${path} is missing`);
    }
    if (actual !== expected)
      throw new Error(
        "admitted journey projection drift; run pnpm exec tsx tooling/acceptance/check-contracts.mts --write",
      );
  }
  return {
    status:
      inventory.admittedPickleKeys.length === 0
        ? "no-admitted-contracts"
        : "contracts-present",
    admittedPickles: inventory.admittedPickleKeys.length,
    wrote: input.write,
  };
};

export const verifyProtectedBaseFixture = async (
  root: string,
  protectedBaseSha: string,
): Promise<void> => {
  const fixturePath = resolve(
    root,
    "tooling/acceptance/fixtures/auth-policy/protected-base.json",
  );
  const digestPath = resolve(
    root,
    "tooling/acceptance/fixtures/auth-policy/protected-base.digest",
  );
  const [fixture, digest] = await Promise.all([
    readFile(fixturePath, "utf8"),
    readFile(digestPath, "utf8"),
  ]);
  const expected = digest.trim().split(/\s+/u)[0];
  if (expected !== createHash("sha256").update(fixture).digest("hex"))
    throw new Error("protected-base auth-policy fixture digest is invalid");
  let parsed: {
    schemaVersion?: unknown;
    baseCommit?: unknown;
    path?: unknown;
    sha256?: unknown;
  };
  try {
    parsed = JSON.parse(fixture) as typeof parsed;
  } catch {
    throw new Error("protected-base auth-policy fixture is unparseable");
  }
  if (parsed.baseCommit !== protectedBaseSha)
    throw new Error(
      "protected-base auth-policy fixture does not bind attested base",
    );
  const authPolicyPath =
    "packages/convex/confect/capabilities/_kit/authPolicies.ts";
  if (
    parsed.schemaVersion !== 1 ||
    parsed.path !== authPolicyPath ||
    typeof parsed.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(parsed.sha256)
  )
    throw new Error(
      "protected-base auth-policy fixture path or digest is invalid",
    );
  let protectedBytes: Buffer;
  try {
    protectedBytes = execFileSync("git", [
      "-C",
      root,
      "show",
      `${protectedBaseSha}:${parsed.path}`,
    ]);
  } catch {
    throw new Error("protected-base auth-policy material is unavailable");
  }
  if (
    createHash("sha256").update(protectedBytes).digest("hex") !== parsed.sha256
  )
    throw new Error(
      "protected-base auth-policy material digest does not match",
    );
};

const trustedControllerAttestationRoot =
  "/var/run/maestro-protected-controller";

type ControllerAttestation = {
  readonly baseSha: string;
  readonly candidateCommit?: string;
  readonly origin: "protected-controller";
  readonly nonce: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly signature: string;
};

const attestationPayload = (
  attestation: Omit<ControllerAttestation, "signature">,
) =>
  JSON.stringify({
    baseSha: attestation.baseSha,
    candidateCommit: attestation.candidateCommit ?? null,
    expiresAt: attestation.expiresAt,
    issuedAt: attestation.issuedAt,
    nonce: attestation.nonce,
    origin: attestation.origin,
  });

export const verifyControllerAttestation = (
  attestationPath: string,
  trustedRoot = trustedControllerAttestationRoot,
): ControllerAttestation => {
  const root = realpathSync(trustedRoot);
  const path = realpathSync(attestationPath);
  if (relative(root, path).startsWith(".."))
    throw new Error("controller attestation is outside the trusted root");
  if ((statSync(path).mode & 0o022) !== 0)
    throw new Error(
      "controller attestation is writable outside the controller",
    );
  const attestation = JSON.parse(
    readFileSync(path, "utf8"),
  ) as Partial<ControllerAttestation>;
  if (
    typeof attestation.baseSha !== "string" ||
    attestation.origin !== "protected-controller" ||
    typeof attestation.nonce !== "string" ||
    typeof attestation.issuedAt !== "number" ||
    typeof attestation.expiresAt !== "number" ||
    typeof attestation.signature !== "string" ||
    attestation.expiresAt <= Date.now() ||
    attestation.issuedAt > Date.now() ||
    attestation.expiresAt - attestation.issuedAt > 300_000
  )
    throw new Error("protected controller attestation is invalid or expired");
  const key = readFileSync(resolve(root, "attestation.key"), "utf8").trim();
  const expected = createHmac("sha256", key)
    .update(
      attestationPayload(
        attestation as Omit<ControllerAttestation, "signature">,
      ),
    )
    .digest("hex");
  if (
    !/^[a-f0-9]{64}$/u.test(attestation.signature) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(attestation.signature))
  )
    throw new Error("protected controller attestation signature is invalid");
  return attestation as ControllerAttestation;
};

export const resolveAcceptanceRun = (
  root: string,
  trustedRoot = trustedControllerAttestationRoot,
): {
  readonly root: string;
  readonly protectedBaseSha: string;
  readonly mode: "authoritative";
} => {
  if (process.env.PROTECTED_BASE_SHA !== undefined)
    throw new Error(
      "candidate environment must not provide the protected base SHA",
    );
  const attestationPath = process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE;
  if (attestationPath === undefined)
    throw new Error("protected controller attestation is required");
  try {
    const attestation = verifyControllerAttestation(
      attestationPath,
      trustedRoot,
    );
    if (
      process.env.PROTECTED_CANDIDATE_COMMIT !== undefined &&
      attestation.candidateCommit !== process.env.PROTECTED_CANDIDATE_COMMIT
    )
      throw new Error(
        "protected controller attestation does not bind this acceptance run",
      );
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(attestation.baseSha))
      throw new Error(
        "protected controller must provide an immutable base SHA",
      );
    return {
      root,
      protectedBaseSha: attestation.baseSha,
      mode: "authoritative",
    };
  } catch {
    throw new Error("protected controller attestation is unreadable");
  }
};

if (isDirectRun(import.meta.url)) {
  await main();
}
