export function hasMode(name: string, argv = process.argv): boolean {
  return argv.includes("--mode") && argv[argv.indexOf("--mode") + 1] === name;
}

export function isCi(env = process.env): boolean {
  return env.CI === "true";
}
