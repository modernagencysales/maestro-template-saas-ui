import { cliFailure } from "./result";
import type {
  CliCommandContext,
  CliCommandHandler,
  CliResult,
  CliRuntimeConfig,
} from "./types";

export const parseCliCommandContext = (
  argv: readonly string[],
): CliCommandContext => {
  const [command, subcommand, target] = argv;

  return { argv, command, subcommand, target };
};

export const findCliHandler = (
  handlers: readonly CliCommandHandler[],
  context: CliCommandContext,
): CliCommandHandler | undefined =>
  handlers.find((candidate) => candidate.matches(context));

export const dispatchCliCommand = (
  handlers: readonly CliCommandHandler[],
  argv: readonly string[],
  config: CliRuntimeConfig,
): CliResult => {
  const context = parseCliCommandContext(argv);
  const handler = findCliHandler(handlers, context);

  const result = handler?.run(context, config);
  return result instanceof Promise
    ? cliFailure("This command requires asynchronous CLI execution.\n")
    : (result ?? cliFailure(`Unknown command: ${argv.join(" ")}\n`));
};

export const dispatchCliCommandAsync = async (
  handlers: readonly CliCommandHandler[],
  argv: readonly string[],
  config: CliRuntimeConfig,
): Promise<CliResult> => {
  const context = parseCliCommandContext(argv);
  const handler = findCliHandler(handlers, context);
  return handler === undefined
    ? cliFailure(`Unknown command: ${argv.join(" ")}\n`)
    : await handler.run(context, config);
};
