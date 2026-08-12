# Saas UI Golden Manual Review

- [ ] `UPSTREAM_REFERENCE_URL` and `GOLDEN_GENERATED_URL` are separate private
      loopback servers.
- [ ] Desktop and mobile captures exist for reference and generated targets in
      light and dark mode using the same neutral fixture.
- [ ] Sidebar resize, collapse, persistence, flyout, mobile backdrop, menus,
      search shortcut, table states, list/board switch, split/detail navigation,
      Kanban drag, dialog/drawer trap and restore, forms, and success/failure
      states were exercised.
- [ ] Keyboard-only traversal, visible focus, and reduced motion were reviewed.
- [ ] Manual owner review at 200% browser zoom confirms the intended layout and
      controls remain usable.
- [ ] Automated 320 px reflow checks pass with no document horizontal overflow.
- [ ] Axe results for both authorities have zero serious or critical findings.
- [ ] Owner approval phrase recorded in the PR: “Approved: pinned reference and
      generated target match the accepted structure and interactions.”
