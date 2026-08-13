import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = Readonly<{
  dependencies?: Readonly<Record<string, string>>;
  devDependencies?: Readonly<Record<string, string>>;
}>;

const root = resolve(import.meta.dirname, "../..");

function packageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as PackageJson;
}

describe("Saas UI Pro registry dependency contract", () => {
  it("pins the target to the Pro-compatible Chakra, preset, and React type graph", () => {
    const app = packageJson("apps/web/package.json");
    const dependencies = app.dependencies ?? {};
    const devDependencies = app.devDependencies ?? {};

    expect(dependencies).toMatchObject({
      "@ark-ui/react": "5.30.0",
      "@chakra-ui/react": "3.30.0",
      "@saas-ui/chakra-preset": "3.0.0-next.8",
      "@saas-ui/react": "3.0.0-next.51",
      "@saas-ui-pro/react": "1.0.0-next.4",
      "@tanstack/react-form": "^1.33.2",
      react: "19.2.0",
      "react-dom": "19.2.0",
      zod: "4.1.5",
    });
    expect(devDependencies).toMatchObject({
      "@types/react": "19.2.2",
      "@types/react-dom": "19.2.0",
    });
  });
});
