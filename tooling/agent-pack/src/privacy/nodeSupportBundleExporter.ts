import { constants, type Stats } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import {
  isAbsolute,
  basename,
  dirname,
  relative,
  resolve,
  sep,
} from "node:path";
import { resolveTargetPath, type RepositoryContext } from "../repoContext.js";
import { isValidSupportBundleOutput } from "./supportBundle.js";

export type SupportBundleExportRequest = {
  readonly repo: RepositoryContext;
  readonly output: string;
  readonly serialized: string;
};

export type SupportBundleExporter = {
  readonly export: (
    request: SupportBundleExportRequest,
  ) => Promise<{ readonly bytes: number }>;
};

type DirectoryIdentity = Pick<Stats, "dev" | "ino">;

export function createNodeSupportBundleExporter(input: {
  readonly maxBytes: number;
  /** Test seam for a deterministic adversarial .maestro ancestor swap. */
  readonly afterMaestroOpen?: (
    maestroDirectory: string,
  ) => void | Promise<void>;
  /** Test seam for a deterministic adversarial support-directory swap. */
  readonly afterDirectoryOpen?: (
    supportDirectory: string,
  ) => void | Promise<void>;
}): SupportBundleExporter {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0)
    throw new Error("Support bundle limit must be a positive integer.");
  return {
    export: async (request) => {
      if (!isValidSupportBundleOutput(request.output))
        throw new Error("Support bundle output path is invalid.");
      const bytes = Buffer.byteLength(request.serialized, "utf8");
      if (bytes > input.maxBytes)
        throw new Error("Support bundle exceeds the bounded export limit.");
      if (!["linux", "darwin", "win32"].includes(process.platform))
        throw new Error(
          "Race-safe support bundle export is unavailable on this host.",
        );

      const destination = resolveTargetPath(request.repo, request.output);
      const maestroDirectory = resolve(request.repo.targetRoot, ".maestro");
      const supportDirectory = dirname(destination);
      const filename = basename(destination);

      if (process.platform === "darwin" || process.platform === "win32") {
        // These hosts lack Linux's stable /proc descriptor traversal. Create an
        // exclusive empty handle first, then write content only after file and
        // parent identities resolve inside the repository.
        return exportWithValidatedFileHandle({
          repositoryRoot: await realpath(request.repo.targetRoot),
          maestroDirectory,
          supportDirectory,
          destination,
          serialized: request.serialized,
          bytes,
          ...(input.afterMaestroOpen === undefined
            ? {}
            : { afterMaestroOpen: input.afterMaestroOpen }),
          ...(input.afterDirectoryOpen === undefined
            ? {}
            : { afterDirectoryOpen: input.afterDirectoryOpen }),
        });
      }

      const descriptorRoot = "/proc/self/fd";

      let maestroHandle: FileHandle | undefined;
      let supportHandle: FileHandle | undefined;
      let fileHandle: FileHandle | undefined;
      let descriptorDestination: string | undefined;
      let createdFileIdentity: DirectoryIdentity | undefined;
      try {
        await access(descriptorRoot);
        const repositoryRoot = await realpath(request.repo.targetRoot);
        await ensureDirectory(maestroDirectory);
        maestroHandle = await openDirectory(maestroDirectory);
        const maestroIdentity = await directoryIdentity(maestroHandle);

        await input.afterMaestroOpen?.(maestroDirectory);
        const maestroTarget = await assertDescriptorInside(
          maestroHandle,
          repositoryRoot,
          descriptorRoot,
        );
        await assertPathIdentity(maestroDirectory, maestroIdentity);

        const descriptorSupportDirectory = `${descriptorRoot}/${maestroHandle.fd}/support`;
        await ensureDirectory(descriptorSupportDirectory);
        supportHandle = await openDirectory(descriptorSupportDirectory);
        const supportIdentity = await directoryIdentity(supportHandle);

        await input.afterDirectoryOpen?.(supportDirectory);
        await assertStableDirectories({
          repositoryRoot,
          maestroDirectory,
          maestroHandle,
          maestroIdentity,
          maestroTarget,
          supportDirectory,
          supportHandle,
          supportIdentity,
          descriptorRoot,
        });

        descriptorDestination = `${descriptorRoot}/${supportHandle.fd}/${filename}`;
        fileHandle = await open(
          descriptorDestination,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        );
        const createdStatus = await fileHandle.stat();
        if (!createdStatus.isFile()) throw new SupportBundleExportRaceError();
        createdFileIdentity = createdStatus;
        await fileHandle.chmod(0o600);
        await fileHandle.writeFile(request.serialized, "utf8");
        await fileHandle.sync();

        await assertStableDirectories({
          repositoryRoot,
          maestroDirectory,
          maestroHandle,
          maestroIdentity,
          maestroTarget,
          supportDirectory,
          supportHandle,
          supportIdentity,
          descriptorRoot,
        });
        await fileHandle.close();
        fileHandle = undefined;
        return { bytes };
      } catch (error) {
        if (
          descriptorDestination !== undefined &&
          createdFileIdentity !== undefined
        ) {
          await unlinkIfIdentityMatches(
            descriptorDestination,
            createdFileIdentity,
          ).catch(() => undefined);
        }
        await fileHandle?.close().catch(() => undefined);
        if (error instanceof SupportBundleExportRaceError) throw error;
        if (errorCode(error) === "EEXIST")
          throw new Error("Support bundle output already exists.");
        throw new Error("Support bundle could not be exported safely.");
      } finally {
        await supportHandle?.close().catch(() => undefined);
        await maestroHandle?.close().catch(() => undefined);
      }
    },
  };
}

class SupportBundleExportRaceError extends Error {
  constructor() {
    super("Support bundle directory changed during export; export refused.");
    this.name = "SupportBundleExportRaceError";
  }
}

async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
  const status = await lstat(path).catch(() => undefined);
  if (status === undefined || !status.isDirectory() || status.isSymbolicLink())
    throw new SupportBundleExportRaceError();
}

async function openDirectory(path: string): Promise<FileHandle> {
  return open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
}

async function directoryIdentity(
  handle: FileHandle,
): Promise<DirectoryIdentity> {
  const status = await handle.stat();
  if (!status.isDirectory()) throw new SupportBundleExportRaceError();
  return status;
}

async function assertStableDirectories(input: {
  readonly repositoryRoot: string;
  readonly maestroDirectory: string;
  readonly maestroHandle: FileHandle;
  readonly maestroIdentity: DirectoryIdentity;
  readonly maestroTarget: string;
  readonly supportDirectory: string;
  readonly supportHandle: FileHandle;
  readonly supportIdentity: DirectoryIdentity;
  readonly descriptorRoot: string;
}): Promise<void> {
  const currentMaestroTarget = await assertDescriptorInside(
    input.maestroHandle,
    input.repositoryRoot,
    input.descriptorRoot,
  );
  const supportTarget = await assertDescriptorInside(
    input.supportHandle,
    input.repositoryRoot,
    input.descriptorRoot,
  );
  if (
    currentMaestroTarget !== input.maestroTarget ||
    !isStrictlyInside(currentMaestroTarget, supportTarget)
  ) {
    throw new SupportBundleExportRaceError();
  }
  await assertPathIdentity(input.maestroDirectory, input.maestroIdentity);
  await assertPathIdentity(input.supportDirectory, input.supportIdentity);
}

async function assertDescriptorInside(
  handle: FileHandle,
  repositoryRoot: string,
  descriptorRoot: string,
): Promise<string> {
  const target = await realpath(`${descriptorRoot}/${handle.fd}`).catch(() => {
    throw new SupportBundleExportRaceError();
  });
  if (!isStrictlyInside(repositoryRoot, target))
    throw new SupportBundleExportRaceError();
  return target;
}

async function exportWithValidatedFileHandle(input: {
  readonly repositoryRoot: string;
  readonly maestroDirectory: string;
  readonly supportDirectory: string;
  readonly destination: string;
  readonly serialized: string;
  readonly bytes: number;
  readonly afterMaestroOpen?: (
    maestroDirectory: string,
  ) => void | Promise<void>;
  readonly afterDirectoryOpen?: (
    supportDirectory: string,
  ) => void | Promise<void>;
}): Promise<{ readonly bytes: number }> {
  let fileHandle: FileHandle | undefined;
  let createdFileIdentity: DirectoryIdentity | undefined;
  try {
    await ensureDirectory(input.maestroDirectory);
    const maestroIdentity = await pathDirectoryIdentity(input.maestroDirectory);
    const maestroTarget = await assertPathDirectoryInside(
      input.maestroDirectory,
      maestroIdentity,
      input.repositoryRoot,
    );

    await input.afterMaestroOpen?.(input.maestroDirectory);
    await assertPathDirectoryInside(
      input.maestroDirectory,
      maestroIdentity,
      input.repositoryRoot,
    );

    await ensureDirectory(input.supportDirectory);
    const supportIdentity = await pathDirectoryIdentity(input.supportDirectory);
    const supportTarget = await assertPathDirectoryInside(
      input.supportDirectory,
      supportIdentity,
      maestroTarget,
    );

    await input.afterDirectoryOpen?.(input.supportDirectory);
    await assertValidatedPathHierarchy({
      repositoryRoot: input.repositoryRoot,
      maestroDirectory: input.maestroDirectory,
      maestroIdentity,
      maestroTarget,
      supportDirectory: input.supportDirectory,
      supportIdentity,
      supportTarget,
    });

    fileHandle = await open(
      input.destination,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        noFollowFlag(),
      0o600,
    );
    const createdStatus = await fileHandle.stat();
    if (!createdStatus.isFile()) throw new SupportBundleExportRaceError();
    createdFileIdentity = createdStatus;
    await assertPathFileInside(
      input.destination,
      createdFileIdentity,
      supportTarget,
    );
    await assertValidatedPathHierarchy({
      repositoryRoot: input.repositoryRoot,
      maestroDirectory: input.maestroDirectory,
      maestroIdentity,
      maestroTarget,
      supportDirectory: input.supportDirectory,
      supportIdentity,
      supportTarget,
    });

    await fileHandle.chmod(0o600);
    await fileHandle.writeFile(input.serialized, "utf8");
    await fileHandle.sync();
    await assertPathFileInside(
      input.destination,
      createdFileIdentity,
      supportTarget,
    );
    await assertValidatedPathHierarchy({
      repositoryRoot: input.repositoryRoot,
      maestroDirectory: input.maestroDirectory,
      maestroIdentity,
      maestroTarget,
      supportDirectory: input.supportDirectory,
      supportIdentity,
      supportTarget,
    });
    await fileHandle.close();
    fileHandle = undefined;
    return { bytes: input.bytes };
  } catch (error) {
    await fileHandle?.close().catch(() => undefined);
    fileHandle = undefined;
    if (createdFileIdentity !== undefined) {
      await unlinkIfIdentityMatches(
        input.destination,
        createdFileIdentity,
      ).catch(() => undefined);
    }
    if (error instanceof SupportBundleExportRaceError) throw error;
    if (errorCode(error) === "EEXIST")
      throw new Error("Support bundle output already exists.");
    throw new Error("Support bundle could not be exported safely.");
  }
}

async function pathDirectoryIdentity(path: string): Promise<DirectoryIdentity> {
  const status = await lstat(path).catch(() => undefined);
  if (status === undefined || !status.isDirectory() || status.isSymbolicLink())
    throw new SupportBundleExportRaceError();
  return status;
}

async function assertPathDirectoryInside(
  path: string,
  expected: DirectoryIdentity,
  parent: string,
): Promise<string> {
  await assertPathIdentity(path, expected);
  const target = await realpath(path).catch(() => {
    throw new SupportBundleExportRaceError();
  });
  if (!isStrictlyInside(parent, target))
    throw new SupportBundleExportRaceError();
  return target;
}

async function assertPathFileInside(
  path: string,
  expected: DirectoryIdentity,
  parent: string,
): Promise<void> {
  const status = await lstat(path).catch(() => undefined);
  if (
    status === undefined ||
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.dev !== expected.dev ||
    status.ino !== expected.ino
  ) {
    throw new SupportBundleExportRaceError();
  }
  const target = await realpath(path).catch(() => {
    throw new SupportBundleExportRaceError();
  });
  if (!isStrictlyInside(parent, target))
    throw new SupportBundleExportRaceError();
}

async function assertValidatedPathHierarchy(input: {
  readonly repositoryRoot: string;
  readonly maestroDirectory: string;
  readonly maestroIdentity: DirectoryIdentity;
  readonly maestroTarget: string;
  readonly supportDirectory: string;
  readonly supportIdentity: DirectoryIdentity;
  readonly supportTarget: string;
}): Promise<void> {
  const maestroTarget = await assertPathDirectoryInside(
    input.maestroDirectory,
    input.maestroIdentity,
    input.repositoryRoot,
  );
  const supportTarget = await assertPathDirectoryInside(
    input.supportDirectory,
    input.supportIdentity,
    maestroTarget,
  );
  if (
    maestroTarget !== input.maestroTarget ||
    supportTarget !== input.supportTarget
  ) {
    throw new SupportBundleExportRaceError();
  }
}

function noFollowFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

async function assertPathIdentity(
  path: string,
  expected: DirectoryIdentity,
): Promise<void> {
  const status = await lstat(path).catch(() => undefined);
  if (
    status === undefined ||
    !status.isDirectory() ||
    status.isSymbolicLink() ||
    status.dev !== expected.dev ||
    status.ino !== expected.ino
  ) {
    throw new SupportBundleExportRaceError();
  }
}

async function unlinkIfIdentityMatches(
  path: string,
  expected: DirectoryIdentity,
): Promise<void> {
  const status = await lstat(path).catch(() => undefined);
  if (
    status?.isFile() &&
    !status.isSymbolicLink() &&
    status.dev === expected.dev &&
    status.ino === expected.ino
  ) {
    await unlink(path);
  }
}

function isStrictlyInside(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return (
    path !== "" &&
    path !== ".." &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
}

function errorCode(error: unknown): unknown {
  return error !== null && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
}
