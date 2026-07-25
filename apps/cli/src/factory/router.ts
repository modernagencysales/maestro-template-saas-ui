import type { CliCommandHandler } from "../types";

/**
 * Factory commands are registered ahead of the legacy runtime CLI handlers.
 * WP-3.2 supplies the first adapter; keeping this empty in WP-3.1 preserves
 * the existing runtime surface without inventing factory behavior.
 */
export const createFactoryCliHandlers = (): readonly CliCommandHandler[] => [];
