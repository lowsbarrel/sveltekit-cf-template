# Feature flags

Flags decouple **deploying** code from **releasing** it. Ship a feature dark, then
turn it on for a slice of users - no revert, instant off-switch. On this stack
that's how you promote safely, instead of gating merges behind a release branch.

## The shape

- **Vocabulary - `$lib/flags.ts`.** Every flag is declared once here (key,
  `description`, `default`, optional `rollout`). Client- and server-safe, no
  secrets. `FlagKey` is derived from the object, so it can't drift.
- **Evaluation - `$lib/server/flags/service.ts`.** A `FlagProvider` resolves the
  declared flags for a request. The default `staticFlagProvider` needs no vendor:
  it returns each flag's `default`, and for flags with a `rollout` it enables a
  **deterministic** slice keyed on the actor id (an actor never flip-flops as you
  raise the percentage).
- **Wiring.** `src/routes/app/+layout.server.ts` calls `resolveFlags` and returns
  `flags` in the layout data, so any authed page or component can read them.

## Using a flag

In a component:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { isEnabled } from '$lib/flags';
</script>

{#if isEnabled(page.data.flags, 'example_flag')}
	<NewThing />
{/if}
```

On the server, where you have an actor:

```ts
const flags = await resolveFlags({ actor: { id: actor.id }, env });
if (flags.example_flag) {
	// ...
}
```

## Rolling out

1. Declare the flag with `default: false` and merge - it ships dark.
2. Add `rollout: 10` in `$lib/flags.ts` and deploy - 10% of actors (a stable slice).
3. Raise to `50`, then `100`. Delete the flag once it's on for everyone.

## Swapping in a provider (runtime flips)

The default resolves flags from code, so changing a rollout is an edit + deploy.
For runtime control - flip without deploying, per-org targeting, experiments -
implement `FlagProvider` against LaunchDarkly / Statsig / Unleash / your own store
and return it from `flagProvider()` in the service. The provider receives
`context.env`, so read SDK keys from bindings there. Nothing else changes: callers
still use `resolveFlags` / `isEnabled`.
