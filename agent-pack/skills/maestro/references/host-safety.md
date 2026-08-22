# Host Safety

Repo-native instructions and committed skills are the default integration.
Plugin installation is optional and skill-only in Phase 2.

- Fake mode has no MCP configuration or process.
- `inspect` is an explicit personal-development opt-in.
- `dev-power` requires a separate effects disclosure and confirmation.
- Environment-value tools are always disabled.
- Production Convex MCP is unsupported.
- Installation must not authenticate Convex, add hooks, launch background
  processes, or mutate a real global home.

Use disposable host configuration directories for installation tests. Remove
only files whose committed checksums still match; preserve user-modified and
unrelated files.
