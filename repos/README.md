# Vendored Upstream Authorities

The directories in this folder are squashed, read-only reference snapshots for
factory maintainers. They are not workspace packages, application dependencies,
or customer-release inputs. Application code must import published packages and
must never import from `repos/*`; generated customer targets omit this folder.

## Exact snapshots

- `repos/effect` comes from <https://github.com/Effect-TS/effect.git> tag
  `effect@4.0.0-beta.102`, peeled commit
  `de2a9a69099993087e57c64df58537c765ac0224`.
- `repos/confect` comes from <https://github.com/rjdellecese/confect.git> tag
  `@confect/core@10.0.0-next.9`, peeled commit
  `ba0fb82222d487bdf62fde2c429e92628f8a0585`. The next.9 Confect package tags
  share this source commit.
- `repos/tanstack-start-starter-kit-pro` comes from
  <https://github.com/saas-js/tanstack-start-starter-kit-pro.git> commit
  `b76cb4514b9ab47f7db87901cb9b593b4adc3129`.
- `repos/saas-ui-pro` comes from
  <https://github.com/saas-js/saas-ui-pro.git> commit
  `ac3a40c8dc05e403f9d501a87c092646891d3c40`. It preserves the complete demo,
  Storybook sources, packages, and assembled block/template examples so an
  agent can select a complete screen before composing from primitives.

The Saas UI snapshots are covered by
`docs/template/saas-ui-vendor-receipt.json`; every tracked file and symlink is
hashed. `pnpm check:saas-ui-screen-catalog` fails if the snapshot or generated
screen catalogue drifts.

Refresh a snapshot only from an exact reviewed tag, omit the upstream `.git`
directory, record the peeled commit here, and run the customer-ownership and
Confect/Effect compatibility gates afterward.
