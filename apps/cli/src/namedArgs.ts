export type CliNamedArgs = {
  readonly workspaceSlug?: string;
  readonly input?: Record<string, unknown>;
  readonly idempotencyKey?: string;
  readonly correlationNonce?: string;
  readonly workflowId?: string;
  readonly mode?: string;
};

export type CliNamedArgsResult =
  | {
      readonly ok: true;
      readonly args: CliNamedArgs;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type CliInputResult =
  | {
      readonly ok: true;
      readonly input: Record<string, unknown>;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type CliTokenValueResult =
  | {
      readonly ok: true;
      readonly value: string;
      readonly nextIndex: number;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type CliParsedFlag = {
  readonly flag: string;
  readonly inlineValue: string | undefined;
};

type CliParsedArgResult =
  | {
      readonly ok: true;
      readonly patch: CliNamedArgs;
      readonly nextIndex: number;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type CliNamedArgPatchResult =
  | {
      readonly ok: true;
      readonly patch: CliNamedArgs;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const cliNamedArgKeys: Readonly<Record<string, keyof CliNamedArgs>> = {
  "--workspace": "workspaceSlug",
  "--workspace-slug": "workspaceSlug",
  "--input": "input",
  "--idempotency": "idempotencyKey",
  "--idempotency-key": "idempotencyKey",
  "--correlation-nonce": "correlationNonce",
  "--workflow": "workflowId",
  "--workflow-id": "workflowId",
  "--mode": "mode",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonRecord = (value: string): CliInputResult => {
  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed)
      ? { ok: true, input: parsed }
      : { ok: false, message: "--input must be a JSON object." };
  } catch (error) {
    return {
      ok: false,
      message: `--input must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const parseFlagToken = (token: string): CliParsedFlag => {
  const [rawFlag, inlineValue] = token.split(/=(.*)/s, 2);

  return {
    flag: rawFlag ?? "",
    inlineValue,
  };
};

const readTokenValue = (
  tokens: readonly string[],
  index: number,
  parsed: CliParsedFlag,
): CliTokenValueResult => {
  if (parsed.inlineValue !== undefined) {
    return { ok: true, value: parsed.inlineValue, nextIndex: index + 1 };
  }

  const value = tokens[index + 1];
  return value === undefined
    ? { ok: false, message: `${parsed.flag} requires a value.` }
    : { ok: true, value, nextIndex: index + 2 };
};

const patchForNamedArg = (
  key: keyof CliNamedArgs,
  value: string,
): CliNamedArgPatchResult => {
  if (key !== "input") {
    return { ok: true, patch: { [key]: value } };
  }

  const parsed = parseJsonRecord(value);
  return parsed.ok ? { ok: true, patch: { input: parsed.input } } : parsed;
};

const parseNamedArgAt = (
  tokens: readonly string[],
  index: number,
): CliParsedArgResult => {
  const parsed = parseFlagToken(tokens[index] ?? "");
  const key = cliNamedArgKeys[parsed.flag];

  if (key === undefined) {
    return { ok: false, message: `Unknown option: ${parsed.flag}` };
  }

  const value = readTokenValue(tokens, index, parsed);
  if (!value.ok) {
    return value;
  }

  const patch = patchForNamedArg(key, value.value);
  return patch.ok ? { ...patch, nextIndex: value.nextIndex } : patch;
};

export const parseNamedArgs = (
  tokens: readonly string[],
): CliNamedArgsResult => {
  let args: CliNamedArgs = {};
  let index = 0;

  while (index < tokens.length) {
    const parsed = parseNamedArgAt(tokens, index);
    if (!parsed.ok) return parsed;
    args = { ...args, ...parsed.patch };
    index = parsed.nextIndex;
  }

  return { ok: true, args };
};
