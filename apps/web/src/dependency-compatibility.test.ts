import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type PackageMetadata = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
};

const readPackage = (relativePath: string): PackageMetadata =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
  ) as PackageMetadata;

const parseVersion = (value: string): readonly [number, number, number] => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/u.exec(value);
  if (!match) throw new Error(`Unsupported semantic version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const satisfiesCaret = (version: string, range: string): boolean => {
  if (!range.startsWith("^")) return version === range;
  const actual = parseVersion(version);
  const minimum = parseVersion(range.slice(1));
  if (actual[0] !== minimum[0]) return false;
  return (
    actual[1] > minimum[1] ||
    (actual[1] === minimum[1] && actual[2] >= minimum[2])
  );
};

describe("frontend dependency compatibility", () => {
  it("keeps React and ReactDOM inside every installed SaaS UI peer range", () => {
    const web = readPackage("../package.json");
    const react = web.dependencies?.react;
    const reactDom = web.dependencies?.["react-dom"];
    expect(react).toBeDefined();
    expect(reactDom).toBe(react);

    for (const packagePath of [
      "../node_modules/@saas-ui/react/package.json",
      "../node_modules/@saas-ui-pro/react/package.json",
    ]) {
      const peers = readPackage(packagePath).peerDependencies;
      expect(peers?.react).toBeDefined();
      expect(peers?.["react-dom"]).toBeDefined();
      expect(satisfiesCaret(react ?? "", peers?.react ?? "")).toBe(true);
      expect(satisfiesCaret(reactDom ?? "", peers?.["react-dom"] ?? "")).toBe(
        true,
      );
    }
  });
});
