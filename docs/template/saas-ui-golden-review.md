# Saas UI Golden Review

Run the pinned reference and a freshly generated target as separate private
loopback servers. Set `UPSTREAM_REFERENCE_URL` and `GOLDEN_GENERATED_URL` to
their URLs and write non-sensitive evidence to `artifacts/saas-ui-golden/`.

Review the same neutral fixtures at authenticated desktop and mobile sizes in
light and dark mode. Confirm shell resize/collapse/persistence/flyout/mobile
backdrop, menus, search shortcuts, table filtering/sorting/paging/selection,
board and detail navigation, Kanban drag, dialogs/drawers, forms, success and
failure states, focus restoration, and visible focus.

Also complete the keyboard-only, reduced-motion, 200% zoom, and 320 px reflow
walkthrough. The document must not have horizontal overflow at 320 px. Run axe
against both authorities; do not approve from a generated screenshot of the
generated app itself.

Owner approval phrase: **Approved: pinned reference and generated target match
the accepted structure and interactions.**
