const generatorHelp = Object.freeze({
  "add-workflow":
    "template:add-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]\nFor consequential writes, use the reviewed scaffold preview and its exact confirmation argv.\n",
  systems:
    "template:systems [--query <exact-id-alias-responsibility-or-table>]\n",
} as const);

export function helpForGenerator(command: string): string | undefined {
  return generatorHelp[command as keyof typeof generatorHelp];
}
