/**
 * Minimal typing for import.meta.env (no Vite dependency).
 * Extend ImportMetaEnv in this file to add known env vars for better autocomplete.
 */
interface ImportMetaEnv {
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
