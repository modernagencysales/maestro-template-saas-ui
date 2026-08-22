---
'@workspace/ui': minor
'web': minor
---

Migrate all forms from `@saas-ui/forms` to TanStack Form.

Adds a shared, headless form layer at `@workspace/ui/form` built on `@tanstack/react-form`'s `createFormHook`: `useAppForm`, a `<Form form={form}>` wrapper, render-prop fields (`form.AppField` → `field.TextField` / `TextareaField` / `SelectField` / `SwitchField` / `EditorField`), and form components `form.Layout`, `form.Footer`, and `form.SubmitButton`. Validation stays on Zod via Standard Schema (no resolver). Removes the direct `@saas-ui/forms`, `@hookform/resolvers`, and `react-hook-form` dependencies.
