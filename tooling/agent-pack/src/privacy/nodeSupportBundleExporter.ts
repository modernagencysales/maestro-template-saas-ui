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
      if (process.platform !== "linux")
        throw new Error(
          "Race-safe support bundle export is unavailable on this host.",
        );

      const destination = resolveTargetPath(request.repo, request.output);
      const maestroDirectory = resolve(request.repo.targetRoot, ".maestro");
      const supportDirectory = dirname(destination);
      const filename = basename(destination);

      let maestroHandle: FileHandle | undefined;
      let supportHandle: FileHandle | undefined;
      let fileHandle: FileHandle | undefined;
      let descriptorDestination: string | undefined;
      let createdFileIdentity: DirectoryIdentity | undefined;
      try {
        await access("/proc/self/fd");
        const repositoryRoot = await realpath(request.repo.targetRoot);
        await ensureDirectory(maestroDirectory);
        maestroHandle = await openDirectory(maestroDirectory);
        const maestroIdentity = await directoryIdentity(maestroHandle);

        await input.afterMaestroOpen?.(maestroDirectory);
        const maestroTarget = await assertDescriptorInside(
          maestroHandle,
          repositoryRoot,
        );
        await assertPathIdentity(maestroDirectory, maestroIdentity);

        const descriptorSupportDirectory = `/proc/self/fd/${maestroHandle.fd}/support`;
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
        });

        descriptorDestination = `/proc/self/fd/${supportHandle.fd}/${filename}`;
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
}): Promise<void> {
  const currentMaestroTarget = await assertDescriptorInside(
    input.maestroHandle,
    input.repositoryRoot,
  );
  const supportTarget = await assertDescriptorInside(
    input.supportHandle,
    input.repositoryRoot,
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
): Promise<string> {
  const target = await realpath(`/proc/self/fd/${handle.fd}`).catch(() => {
    throw new SupportBundleExportRaceError();
  });
  if (!isStrictlyInside(repositoryRoot, target))
    throw new SupportBundleExportRaceError();
  return target;
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
