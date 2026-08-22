# Migrate app from `@saas-ui/forms` to TanStack Form

## Blockers & Learnings (updated during implementation)

Recorded as we hit them, so the rest of the migration and future work can reuse them.

- **`@tanstack/react-form` version:** installed `^1.33.1` in both `packages/ui` and `apps/web`. TanStack Form is Standard-Schema native, so Zod v4 schemas pass straight into `validators` with no resolver.
- **Avoid a circular import in the factory:** `createFormHookContexts()` lives in its own file (`form-context.ts`) that the field components import from. `create-form.tsx` imports both the contexts and the components to call `createFormHook`. Putting the contexts in `create-form.tsx` would create a cycle (factory → field → factory) that breaks module init.
- **Saas UI `Switch` is a single component, not a namespace.** Use `<Switch checked onCheckedChange={({checked}) => …}>` — there is no `Switch.Root/Control/HiddenInput` in `@saas-ui/react` (that's the raw Chakra/Ark API). Same for password: `@saas-ui/react` exports a ready-made `PasswordInput` (with show/hide toggle) — use it for `type="password"`.
- **Interface-extend conflicts on `label`/`form`.** Chakra prop types (`EditorProps`, `SwitchProps`, `InputProps`) carry their own `label` and an HTML `form` attribute. When a field-props interface extends both `BaseFieldProps` and a Chakra prop type, TS errors on the non-identical `label`. Fix: `Omit<ChakraProps, … | keyof BaseFieldProps>`, and also omit `'form'` from input-based props so a `form` object prop (ConfirmPasswordField) doesn't clash with the HTML `form` string attr.
- **`useFormContext()` is NOT the app form (type-wise).** The context hook from `createFormHookContexts` returns the base `ReactFormExtendedApi` which does **not** type-expose `AppField`/registered field components (only `useAppForm`'s return does). So `SubmitButton` (which only needs `Subscribe`/submit state) can read `useFormContext()`, but a reusable that needs `field.TextField`/`AppField` (e.g. `ConfirmPasswordField`) must take the `form` as a prop.
- **A `form`-accepting component must be GENERIC over the form type — don't widen to `any`.** `type AnyAppForm = ReturnType<typeof useAppForm>` resolves the generics to their `unknown` defaults, and `FormApi` is invariant in `TFormData`, so a concrete `useAppForm<{email:string}>()` result is **not** assignable to it (nor to an `any`-widened version cleanly). The fix that preserves types: make the wrapper generic and constrain it structurally to only what it uses. E.g. `Form`:
  ```tsx
  export function Form<TForm extends { AppForm: React.ComponentType<React.PropsWithChildren>; handleSubmit: () => unknown }>(
    props: { form: TForm; children: React.ReactNode } & React.ComponentProps<typeof chakra.form>,
  ) { … <form.AppForm><chakra.form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>…</chakra.form></form.AppForm> }
  ```
  Same for `AuthForm` and `ConfirmPasswordField` — each generic, constrained to the members it calls (`AppForm`/`handleSubmit`, or `AppField`/`getFieldValue`). This forwards the concrete form's generics instead of erasing them.
- **`Editor` `onChange` typing:** the old `Editor` leaked a DOM `onChange` (hence a `@ts-ignore`). Retyped it as `onChange?: (value: string) => void` (omitting the DOM one from the chakra base) so the field wrapper binds cleanly; removed the `@ts-ignore`.
- **Stories must be rewritten, not just re-imported:** `@saas-ui/forms/zod`'s `Form`/`createZodForm` and `PasswordInputField` have no TanStack equivalent — the two stories were rebuilt on `useAppForm` + render-props.
- **Keep the `@saas-ui/forms` pnpm `override`, even after removing the direct deps.** `@saas-ui/forms` is a transitive dependency of `@saas-ui-pro/react@1.0.0-next.4` (which pulls `@saas-ui/forms@3.0.0-next.47`, an unpublished version). The root `pnpm.overrides["@saas-ui/forms"] = "3.0.0-next.52"` pins it to a resolvable version; removing that override breaks `pnpm install` with `ERR_PNPM_NO_MATCHING_VERSION`. We removed the direct deps from `apps/web` + `packages/ui` (no source imports remain) but left the override in place.
- **KNOWN OPEN ISSUE — `SubmitButton` `variant="primary"` fails `packages/ui` typecheck.** `primary`/`secondary` are app-theme button variants defined in `apps/web/src/theme/preset.ts`; the base `@saas-ui/react` `Button` type only knows `ghost|outline|plain|solid|subtle|surface`. `apps/web` is never tsc-checked (its turbo `typecheck` task is empty), so it never surfaces there, but `packages/ui` (which has a real `tsc` typecheck) rejects it. `pnpm generate:tokens` (`chakra typegen`) regenerates the recipe typings, but the repo has two `@chakra-ui/react` pnpm instances and `@saas-ui/react`'s `Button` re-export resolves through the one typegen doesn't update. **Deferred** per decision — left as-is for now; revisit by pointing typegen at the correct instance or de-duping the Chakra install.

## Finalized call-site pattern (follow this for every form)

`Form` renders **both** the `<form>` element and the `form.AppForm` context provider, so there is no `<form.AppForm><form.Form>` double-nesting. `form.AppField` binds fields directly (it does not need `AppForm`); `form.SubmitButton` reads the form from context (provided by `Form`).

```tsx
import { Form, useAppForm } from '@workspace/ui/form'

const form = useAppForm({
  validators: { onBlur: schema, onSubmit: schema }, // onBlur ≈ old mode:'onTouched'; display gated by isTouched
  defaultValues: { … },
  onSubmit: async ({ value }: { value: MyInput }) => { await mutateAsync(value) }, // note ({ value }), not (values)
})

<Form form={form}>
  <form.Layout labelWidth="142px">
    <form.AppField name="email">
      {(field) => <field.TextField label="Email" type="email" />}
    </form.AppField>
    <form.Footer>
      <form.SubmitButton>Save</form.SubmitButton>
    </form.Footer>
  </form.Layout>
</Form>
```

- **Use `<Form form={form}>` directly** in each page (no per-feature wrapper). Wrap fields in `form.Layout` for consistent spacing; simple stacked forms work with fields nested directly too.
- **`form.Layout`** (registered component; standalone export `Layout`) is a vertical `Stack`. It takes a `labelWidth` prop that sets the `--field-label-width` CSS var for horizontal-orientation fields — prefer this over hand-writing `css={{ '--field-label-width': … }}`.
- **`form.Footer`** (standalone export `Footer`) is the actions row for the submit button. It indents by `calc(var(--field-label-width, 0px) + <spacing>)` so actions line up under the field column in horizontal forms, and falls back to no indent when `labelWidth` is unset.
- **`SubmitButton` default styling:** the shared `SubmitButton` renders `variant="primary" colorPalette="accent"` by default.
- **`Form`, and any component taking a `form` prop, is generic** (`<TForm extends FormLike>`) so the concrete form generics are forwarded, not erased.
- **Field components:** `TextField` (text/email/password/tel/url — password → `PasswordInput`), `TextareaField`, `SelectField` (single/multiple, `options`), `SwitchField`, `EditorField`. All read `useFieldContext`, render Chakra `Field.*`, and gate error display on `field.state.meta.isTouched`.

## Context

The app currently builds every form on **`@saas-ui/forms` v3 (next.52)**, which is a React-Hook-Form–based layer that provides _both_ form state _and_ a UI layer (`useForm`, `form.Form`, `form.Field`, `FormLayout`, `SubmitButton`, auto-rendered labeled fields, a custom-field-type registry). The goal is to move all form state/validation to **TanStack Form (`@tanstack/react-form`)** using its `createFormHook` composition API.

The key architectural fact driving this plan: **TanStack Form is a headless state/validation library — it provides no UI.** Everything `@saas-ui/forms` rendered for us (labeled `Field`, layout, submit button, select rendering, error text) must be **rebuilt as a small component layer** on top of Chakra UI 3 / Saas UI 3 primitives (`Field.*`, `Input`, `Textarea`, `Select`, `Switch`, `Button`). Validation stays 100% Zod — Zod v4 is Standard-Schema compliant, so schemas pass straight into TanStack Form with no resolver.

**Decisions made with the user:**

- **Field API:** _Pure TanStack render-props_ everywhere — `<form.AppField name>{(field) => <field.TextField … />}</form.AppField>`. No terse `FormField` dispatcher; we accept the extra verbosity to get full per-form name/value type-safety.
- **Scope:** _Full migration + remove dependency_ — migrate all ~20 forms, delete `fields-provider.tsx`, and drop `@saas-ui/forms`, `@hookform/resolvers`, `react-hook-form` from `package.json`.

Outcome: one owned, type-safe form layer in `packages/ui/src/form/`, no `@saas-ui/forms` dependency, identical UX.

## Scope: files that import `@saas-ui/forms` (22)

New shared layer + these call-sites. `packages/ui` exports map `@workspace/ui/*` → `packages/ui/src/*/index.ts`, so the new module is imported as `@workspace/ui/form`.

- **Auth (5):** `login-page.tsx`, `signup-page.tsx`, `forgot-password-page.tsx`, `reset-password-page.tsx` + schemas in `features/auth/schema/`
- **Settings (5):** `account/account-profile-page.tsx`, `account/update-password-dialog.tsx`, `billing/billing-page.tsx`, `members/members-list.tsx` (select multiple), `workspace/workspace-settings-page.tsx` (hardest — imperative slug flow)
- **Getting-started (5):** `create-workspace.tsx` (imperative slug), `invite-team-members.tsx`, `appearance.tsx`, `subscribe.tsx` (raw Switch), `onboarding-step.tsx` (`SubmitButton`)
- **Contacts (2):** `contacts/list/add-person-dialog.tsx`, `contacts/view/activity-timeline.tsx` (EditorField + ⌘-Enter submit)
- **packages/ui (5):** `invite-dialog/invite-dialog.tsx`, `confirm-password-field/*` (2), `editor/editor.tsx` + `editor.stories.tsx`
- **Delete:** `apps/web/src/components/fields-provider.tsx` (obsolete — replaced by `createFormHook`'s `fieldComponents`)

## Step 1 — Build the shared form layer (`packages/ui/src/form/`)

Add `@tanstack/react-form` to `packages/ui/package.json` (and `apps/web/package.json`). Create the module (barrel `index.ts` re-exports everything below).

**`create-form.tsx` — the factory:**

```tsx
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

// import the field + form components below

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    SwitchField,
    EditorField,
  },
  formComponents: { Layout, Footer, SubmitButton },
})
// `Form` is a standalone generic export (takes a `form` prop), not a registered formComponent.
```

**`utils.ts` — Standard-Schema errors are objects `{ message }`, not strings; centralize extraction:**

```tsx
export function getErrorText(
  errors: unknown[] | undefined,
): string | undefined {
  const first = errors?.[0]
  if (first == null) return undefined
  return typeof first === 'string'
    ? first
    : (first as { message?: string }).message
}
```

**Field components** (`fields/*.tsx`) — each calls `useFieldContext<T>()`, renders Chakra 3 `Field.Root`/`Field.Label`/`Field.HelperText`/`Field.ErrorText`, and wires `field.state.value` → control, `field.handleChange` / `field.handleBlur` → events, and `getErrorText(field.state.meta.errors)` gated by `field.state.meta.isTouched` for display. Shared `BaseFieldProps`: `label`, `help`, `orientation`, `required`, `rootProps`.

- **`TextField`** — covers `text`/`email`/`password`/`tel`/`url` via a `type` prop. `forwardRef` to `<Input>`. `startElement`/`endElement` → Chakra `InputGroup`. Preserve a caller-supplied `onChange` _in addition to_ `field.handleChange` (needed by the slug slugify-on-change). Thread `autoComplete`, `autoFocus`, `placeholder`, `ps`, etc.
- **`TextareaField`** — same shape, `<Textarea>`, `forwardRef` (invite dialog initial-focus target).
- **`SelectField`** — Chakra 3 collection API (`createListCollection`, `Select.Root value={string[]} onValueChange={({value})=>…}`). Adapt scalar⇄array: single → `field.handleChange(value[0] ?? '')`, multiple → `field.handleChange(value)`. Covers invite `role` (single) and `members-list` `roles` (`multiple`). Mirror the existing pattern in `apps/web/src/features/contacts/list/list-page.tsx:240`.
- **`SwitchField`** — `boolean` value; `<Switch checked onCheckedChange={({checked})=>field.handleChange(checked)}>`.
- **`EditorField`** — **reuse the existing `Editor`** from `packages/ui/src/editor/editor.tsx` unchanged (already controlled: `value`/`onChange(html)`/`editorRef`). Only the wrapper changes: drop `createField` from `@saas-ui/forms`, wire onto `useFieldContext<string>()`. Pass through `placeholder`, `onKeyDown` (⌘-Enter), etc.

**Form components:**

- **`Form`** — standalone, generic over the form (`<TForm extends FormLike>`); takes a `form` prop. Renders `<form.AppForm>` (context provider) wrapping `<chakra.form noValidate onSubmit={e => { e.preventDefault(); e.stopPropagation(); form.handleSubmit() }}>` — so a single wrapper both provides context and renders the `<form>` element (no `<form.AppForm><form.Form>` nesting).
- **`Layout`** (`form.Layout`) — vertical `<Stack gap="4" width="full">` with a `labelWidth` prop that sets the `--field-label-width` var for horizontal-orientation fields (prefer over hand-writing the css var).
- **`Footer`** (`form.Footer`) — actions row (`Group`) for the submit button; indents by `calc(var(--field-label-width, 0px) + <spacing>)` so actions align under the field column, falling back to no indent when unset.
- **`SubmitButton`** — `forwardRef` to `<Button type="submit">` (default `variant="primary" colorPalette="accent"`); reads the form via `useFormContext()` and subscribes via `form.Subscribe selector={s => ({ isSubmitting: s.isSubmitting, canSubmit: s.canSubmit })}` → `loading={isSubmitting}`, `disabled={disabled ?? !canSubmit}`. `loadingText` for signup. Ref supports activity-timeline ⌘-Enter `submitRef.current?.click()`.

## Step 2 — Port the two reusable components in `packages/ui`

- **`EditorField`** (see above) — new home `packages/ui/src/form/fields/editor-field.tsx`, reusing `Editor`.
- **`ConfirmPasswordField`** — redesign onto `useFormContext()` + a field validator with `onChangeListenTo: ['password']` (TanStack's cross-field revalidation primitive) that compares to `form.getFieldValue(confirmField)`. Note: the reset/update-password **schemas already encode the match via `.superRefine`** — TanStack maps each Standard-Schema issue to the field named by its `path`, so those forms need _no_ `ConfirmPasswordField`. Keep the component only for ad-hoc forms without a schema match rule.

## Step 3 — Migrate call-sites (pure render-prop pattern)

Every form: `useForm` → `useAppForm`; wrap body in `<form.AppForm><form.Form>…</form.Form></form.AppForm>`; each `<form.Field name … />` becomes:

```tsx
<form.AppField name="email">
  {(field) => (
    <field.TextField label="Email" type="email" autoComplete="email" />
  )}
</form.AppField>
```

**Validation wiring on `useAppForm`** — pass the Zod schema at form level; no resolver:

```tsx
const form = useAppForm({
  defaultValues: { email: '', password: '' },
  validators: { onBlur: loginSchema, onSubmit: loginSchema }, // approximates old mode:'onTouched'
  onSubmit: async ({ value }) => {
    await mutation.mutateAsync(value)
  },
})
```

Note the **`onSubmit` signature change**: saas-ui passed `(values)`, TanStack passes `({ value })`.

**`mode` → `validators` mapping** (old single `mode` prop has no direct equivalent):

- `onSubmit` → `{ onSubmit: schema }`
- `onBlur` → `{ onBlur: schema }`
- `onTouched` (app default) → `{ onBlur: schema, onSubmit: schema }`, display gated by `field.state.meta.isTouched` (already handled in every field)
- `onChange` → add `onChange: schema`

**RHF `rules` → field `validators`:** e.g. invite `emails` `rules={{ required: msg }}` → `<form.AppField name="emails" validators={{ onChange: ({ value }) => (!value ? requiredLabel : undefined) }}>`. Prefer moving `required` into the Zod schema where practical.

**Imperative-API cheat-sheet** (used by create-workspace + workspace-settings):

| saas-ui / RHF                 | TanStack Form                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `form.setValue(n, v)`         | `form.setFieldValue(n, v)`                                                              |
| `form.getValues(n)`           | `form.getFieldValue(n)` / `form.state.values`                                           |
| `form.setError(n, {message})` | `form.setFieldMeta(n, p => ({ ...p, errorMap: { ...p.errorMap, onServer: message } }))` |
| `form.clearErrors(n)`         | same, `onServer: undefined`                                                             |
| `form.reset(vals)`            | `form.reset(vals)`                                                                      |

**Async slug availability** (`create-workspace.tsx`, `workspace-settings-page.tsx`) — keep the existing external tRPC `slugAvailable` mutation + spinner/check `endElement` (it reads `.isPending`/`.data`), and drive the field error imperatively via `setFieldMeta(... errorMap.onServer ...)` in the mutation's `onSettled`, plus `setFieldValue('slug', …)` on change. `field.state.meta.errors` merges all `errorMap` slots, so the `onServer` message renders through the standard `ErrorText`. (A pure `onChangeAsync` debounced validator is the cleaner pattern for forms without an external spinner, but these two have one — preserve UX.)

**Special cases:**

- `activity-timeline.tsx` — `EditorField` + `submitRef` on `SubmitButton` for ⌘-Enter; ref forwards cleanly.
- `subscribe.tsx` — replace the raw `<Switch name="newsletter">` with `<field.SwitchField>` inside an `AppField`.
- `create-workspace.tsx` / `workspace-settings-page.tsx` — reuse `workspaceSchema.shape.slug.safeParse(...)` for the live inline slug-valid indicator exactly as today.
- `onboarding-step.tsx` — swap `SubmitButton` import to the new one.

## Step 4 — Remove the old dependency

- Delete `apps/web/src/components/fields-provider.tsx` and its usage in the provider tree (replaced by `createFormHook` `fieldComponents`).
- Once no `@saas-ui/forms` imports remain (verify with `grep -rl "@saas-ui/forms" apps/web/src packages/ui/src`), remove `@saas-ui/forms`, `@hookform/resolvers`, and `react-hook-form` from `apps/web/package.json` and `packages/ui/package.json`. Add `@tanstack/react-form`. Run `pnpm install`.
- Update the two Storybook stories (`confirm-password-field.stories.tsx`, `editor.stories.tsx`) to the new API (they import `Form`/`createZodForm` from `@saas-ui/forms/zod`).

## Things TanStack Form does NOT cover (handle explicitly)

1. **Labels from Zod `.describe()`** — no schema introspection. Pass `label` explicitly at every call-site (already the dominant pattern). Do not rely on auto-derivation.
2. **Auto field-type inference / `AutoForm` / `defaultFieldTypes`** — gone. `type` is explicit on every field. No schema-driven auto-form; none is needed in this app.
3. **`FieldsProvider` runtime registry** — replaced by `createFormHook` `fieldComponents` (registered at factory time).
4. **Single `mode` prop** — expressed as the `validators` event map + `isTouched` display gate.

## Verification

1. `pnpm typecheck` and `pnpm check:fast` (lint + types) across the monorepo — must be clean.
2. `pnpm dev:web` and manually exercise, watching browser console + terminal for tRPC/validation errors:
   - **Login** (`/login`) — invalid creds error toast, empty-field validation, ⌘-Enter, autofocus.
   - **Signup / forgot / reset password** — cross-field password-match error surfaces on `confirmPassword` (schema `.superRefine`).
   - **Getting-started → Create workspace** — type a name, confirm slug slugifies live, spinner + taken-slug error render, submit advances the stepper.
   - **Settings → Profile** (horizontal orientation + `--field-label-width`), **Members** (role select single + multiple), **Workspace** (imperative slug flow), **Billing** (email field).
   - **Contacts → add person dialog**, and **activity timeline** — editor field submits a comment, ⌘-Enter works.
   - **Invite dialog** — textarea required validation, role select, email-splitting on submit.
3. `pnpm storybook` — the two migrated stories render and submit.
4. Final `grep -rl "@saas-ui/forms" apps packages` returns nothing; `pnpm install` succeeds with the deps removed.

## Suggested sequencing

Build layer (Step 1) → port `EditorField`/`ConfirmPasswordField` (Step 2) → migrate leaf forms first (auth, add-person, update-password, invite-dialog) → orientation/select forms (profile, billing, members) → imperative slug forms (create-workspace, workspace-settings) → activity-timeline → delete `fields-provider.tsx` + drop deps (Step 4).
