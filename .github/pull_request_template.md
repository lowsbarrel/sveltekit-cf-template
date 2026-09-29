## What & why

## Checklist

- [ ] Title is Conventional Commits (`type(scope): summary`, ≤72 chars) - it becomes the squash subject
- [ ] `bun run lint && bun run check && bun run check:invariants && bun run check:secrets && bun run test` all pass in `app/`
- [ ] Docs (`docs/`) and Paraglide messages updated if behavior or copy changed
- [ ] Verified on the PR preview URL
