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

Refresh a snapshot only from an exact reviewed tag, omit the upstream `.git`
directory, record the peeled commit here, and run the customer-ownership and
Confect/Effect compatibility gates afterward.
