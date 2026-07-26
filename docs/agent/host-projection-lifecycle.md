# Disposable host projection lifecycle

Maestro's versioned Claude Code and Codex projection lifecycle is deliberately
limited to clean temporary homes created under the operating system temporary
directory. It never targets a developer's real home, authentication state, MCP
configuration, or host settings.

The lifecycle writes only Maestro and vendored official Convex skill files
beneath `.claude/skills` or `.codex/skills`. A schema-versioned receipt records
the projection version, aggregate source checksum, and the source and installed
checksum of every managed regular file.

Updates validate the prior receipt and every managed checksum. User-modified
managed files fail closed unless `backup-and-replace` is explicitly selected;
that path preserves the modified bytes in the transaction directory. Unmanaged
files are never adopted or removed. Uninstall removes only receipt-owned files
whose bytes still match the receipt and preserves all changed or unmanaged
files.

Install and update stage source bytes before mutation and write a recovery
journal plus checksummed prior projection backup. A failed or interrupted update
restores the complete prior projection before returning. A completed update
retains that backup for explicit rollback. Symlinks, path escapes, special
files, and non-regular sources or targets are rejected.

This is a local conformance boundary, not release or promotion authority. Tests
must provide disposable homes named `maestro-claude-*` or `maestro-codex-*` and
must not redirect the boundary at real host configuration.
