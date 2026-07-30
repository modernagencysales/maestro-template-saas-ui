const generatorHelp = Object.freeze({
  "add-workflow":
    "template:add-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]\n",
  systems:
    "template:systems [--query <exact-id-alias-responsibility-or-table>]\n",
} as const);

export function helpForGenerator(command: string): string | undefined {
  return generatorHelp[command as keyof typeof generatorHelp];
}
