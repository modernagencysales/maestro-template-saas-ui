import type { ContractTransport } from "@maestro-template/template-core/product-contract";

import { ScenarioObservations, type ObservationKind } from "./observations";

export type CliLaunchRequest = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly credentials: Readonly<Record<string, string>>;
  readonly shell: false;
};

export type CliLaunchResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type CliLauncher = (
  request: CliLaunchRequest,
) => Promise<CliLaunchResult>;

export type CliExpectation = {
  readonly exitCode?: number;
  readonly stdoutIncludes?: string;
  readonly stderrIncludes?: string;
};

export class CliDriver {
  readonly #executable: string;
  readonly #launcher: CliLauncher;
  readonly #environment: Readonly<Record<string, string>>;
  readonly #credentials: Readonly<Record<string, string>>;
  readonly #observations: ScenarioObservations;
  readonly #surfaceId: string;
  readonly #transport: ContractTransport;

  constructor(input: {
    readonly executable: string;
    readonly launcher: CliLauncher;
    readonly environment: Readonly<Record<string, string>>;
    readonly credentials: Readonly<Record<string, string>>;
    readonly observations: ScenarioObservations;
    readonly surfaceId: string;
    readonly transport: ContractTransport;
  }) {
    this.#executable = input.executable;
    this.#launcher = input.launcher;
    this.#environment = { ...input.environment };
    this.#credentials = { ...input.credentials };
    this.#observations = input.observations;
    this.#surfaceId = input.surfaceId;
    this.#transport = input.transport;
  }

  async #run(
    kind: ObservationKind,
    args: readonly string[],
    expected: CliExpectation,
  ): Promise<CliLaunchResult> {
    const result = await this.#launcher({
      executable: this.#executable,
      args: [...args],
      env: { ...this.#environment },
      credentials: { ...this.#credentials },
      shell: false,
    });
    const expectedExitCode = expected.exitCode ?? 0;
    if (result.exitCode !== expectedExitCode)
      throw new Error(
        `CLI exit code ${result.exitCode} differs from ${expectedExitCode}.`,
      );
    if (
      expected.stdoutIncludes !== undefined &&
      !result.stdout.includes(expected.stdoutIncludes)
    )
      throw new Error(
        `CLI stdout does not include ${JSON.stringify(expected.stdoutIncludes)}.`,
      );
    if (
      expected.stderrIncludes !== undefined &&
      !result.stderr.includes(expected.stderrIncludes)
    )
      throw new Error(
        `CLI stderr does not include ${JSON.stringify(expected.stderrIncludes)}.`,
      );
    this.#observations.recordBoundary({
      kind,
      surfaceId: this.#surfaceId,
      transport: this.#transport,
    });
    return result;
  }

  runAction(
    args: readonly string[],
    expected: CliExpectation,
  ): Promise<CliLaunchResult> {
    return this.#run("action", args, expected);
  }

  runOutcome(
    args: readonly string[],
    expected: CliExpectation,
  ): Promise<CliLaunchResult> {
    return this.#run("outcome", args, expected);
  }
}
