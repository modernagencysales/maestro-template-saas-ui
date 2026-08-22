import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  checkSaasUiFoundation,
  readSaasUiAcceptance,
  readSaasUiDeviations,
  readSaasUiManifest,
  readSaasUiRegistryFiles,
} from "./saas-ui-foundation.js";

const root = resolve(import.meta.dirname, "../..");

describe("Saas UI foundation authorities", () => {
  it("pins every paid source and keeps the literal Starter deviation-free", () => {
    const manifest = readSaasUiManifest(root);

    expect(manifest.pins).toEqual({
      template: "acf0bc4be38dea842f321831387fc77cf7242439",
      starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
      pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    });
    expect(new Set(manifest.compositions.map(({ id }) => id))).toEqual(
      new Set([
        "app-shell",
        "dashboard-report",
        "data-grid",
        "filterable-collection",
        "list-detail",
        "split-inbox",
        "record-aside",
        "settings",
        "form",
        "onboarding",
        "kanban",
        "showcase",
        "auth",
        "billing",
        "search-command",
        "states",
      ]),
    );
    expect(readSaasUiDeviations(root)).toEqual([]);
    expect(readSaasUiRegistryFiles(root).files.length).toBeGreaterThan(0);
    expect(checkSaasUiFoundation(root)).toEqual([]);
  });

  it("requires every composition to have acceptance evidence", () => {
    const manifest = readSaasUiManifest(root);
    const acceptance = readSaasUiAcceptance(root);

    expect(acceptance.entries).toHaveLength(manifest.compositions.length);
    expect(new Set(acceptance.entries.map(({ id }) => id))).toEqual(
      new Set(manifest.compositions.map(({ id }) => id)),
    );
    expect(
      acceptance.entries.every(
        ({ route, behaviorCheck, evidence }) =>
          route.startsWith("/") &&
          behaviorCheck.length > 0 &&
          evidence.length > 0,
      ),
    ).toBe(true);
  });

  it("maps archetypes to the literal Starter route tree", () => {
    const routes = Object.fromEntries(
      readSaasUiAcceptance(root).entries.map(({ id, route }) => [id, route]),
    );

    expect(routes).toMatchObject({
      "app-shell": "/$workspace",
      "dashboard-report": "/$workspace",
      "data-grid": "/$workspace/contacts",
      "filterable-collection": "/$workspace/contacts",
      "list-detail": "/$workspace/contacts/view/$id",
      "split-inbox": "/$workspace/inbox",
      "record-aside": "/$workspace/contacts/view/$id",
      settings: "/$workspace/settings",
      form: "/getting-started",
      onboarding: "/getting-started",
      kanban: "/$workspace/kanban",
      showcase: "/$workspace/showcase",
      auth: "/login",
      billing: "/$workspace/settings/billing",
      "search-command": "/$workspace/search",
      states: "/$workspace",
    });
  });

  it("rejects installed registry ids that drift from the pinned receipt", () => {
    const checkout = mkdtempSync(join(tmpdir(), "saas-ui-foundation-"));

    try {
      mkdirSync(join(checkout, "docs/template"), { recursive: true });
      mkdirSync(join(checkout, "apps/web/src"), { recursive: true });
      for (const path of [
        "docs/template/saas-ui-upstream.json",
        "docs/template/saas-ui-deviations.json",
        "docs/template/saas-ui-acceptance.json",
        "docs/template/saas-ui-registry-files.json",
        "apps/web/components.json",
      ]) {
        mkdirSync(join(checkout, path, ".."), { recursive: true });
        copyFileSync(join(root, path), join(checkout, path));
      }
      symlinkSync(
        join(root, "apps/web/src/components"),
        join(checkout, "apps/web/src/components"),
      );
      const configPath = join(checkout, "apps/web/components.json");
      const config = JSON.parse(readFileSync(configPath, "utf8")) as {
        installed: string[];
      };
      config.installed = config.installed.slice(1);
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      expect(checkSaasUiFoundation(checkout)).toContain(
        "components.json installed registry ids do not match the pinned receipt",
      );
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("rejects a registry receipt catalog that omits an installed root", () => {
    const checkout = mkdtempSync(join(tmpdir(), "saas-ui-foundation-"));

    try {
      mkdirSync(join(checkout, "docs/template"), { recursive: true });
      mkdirSync(join(checkout, "apps/web/src"), { recursive: true });
      for (const path of [
        "docs/template/saas-ui-upstream.json",
        "docs/template/saas-ui-deviations.json",
        "docs/template/saas-ui-acceptance.json",
        "docs/template/saas-ui-registry-files.json",
        "apps/web/components.json",
      ]) {
        mkdirSync(join(checkout, path, ".."), { recursive: true });
        copyFileSync(join(root, path), join(checkout, path));
      }
      symlinkSync(
        join(root, "apps/web/src/components"),
        join(checkout, "apps/web/src/components"),
      );
      const manifest = readSaasUiManifest(root);
      const receiptPath = join(
        checkout,
        "docs/template/saas-ui-registry-files.json",
      );
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
        installed: string[];
      };
      receipt.installed = [...(manifest.registry.installed ?? [])].slice(1);
      writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

      expect(checkSaasUiFoundation(checkout)).toContain(
        "registry receipt installed ids do not match its file roots",
      );
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("rejects an unpinned manifest registry source commit", () => {
    const checkout = mkdtempSync(join(tmpdir(), "saas-ui-foundation-"));

    try {
      mkdirSync(join(checkout, "docs/template"), { recursive: true });
      mkdirSync(join(checkout, "apps/web/src"), { recursive: true });
      for (const path of [
        "docs/template/saas-ui-upstream.json",
        "docs/template/saas-ui-deviations.json",
        "docs/template/saas-ui-acceptance.json",
        "docs/template/saas-ui-registry-files.json",
        "apps/web/components.json",
      ]) {
        mkdirSync(join(checkout, path, ".."), { recursive: true });
        copyFileSync(join(root, path), join(checkout, path));
      }
      symlinkSync(
        join(root, "apps/web/src/components"),
        join(checkout, "apps/web/src/components"),
      );
      const manifestPath = join(
        checkout,
        "docs/template/saas-ui-upstream.json",
      );
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        registry: { sourceCommit?: string };
      };
      manifest.registry.sourceCommit = "unpinned-pro-commit";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      expect(checkSaasUiFoundation(checkout)).toContain(
        "manifest registry source commit is not the approved Pro pin",
      );
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("requires a manifest registry source commit", () => {
    const checkout = mkdtempSync(join(tmpdir(), "saas-ui-foundation-"));

    try {
      mkdirSync(join(checkout, "docs/template"), { recursive: true });
      mkdirSync(join(checkout, "apps/web/src"), { recursive: true });
      for (const path of [
        "docs/template/saas-ui-upstream.json",
        "docs/template/saas-ui-deviations.json",
        "docs/template/saas-ui-acceptance.json",
        "docs/template/saas-ui-registry-files.json",
        "apps/web/components.json",
      ]) {
        mkdirSync(join(checkout, path, ".."), { recursive: true });
        copyFileSync(join(root, path), join(checkout, path));
      }
      symlinkSync(
        join(root, "apps/web/src/components"),
        join(checkout, "apps/web/src/components"),
      );
      const manifestPath = join(
        checkout,
        "docs/template/saas-ui-upstream.json",
      );
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        registry: { sourceCommit?: string };
      };
      delete manifest.registry.sourceCommit;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      expect(checkSaasUiFoundation(checkout)).toContain(
        "registry.sourceCommit must be a non-empty string",
      );
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });
});
