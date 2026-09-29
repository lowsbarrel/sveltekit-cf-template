# UI & components

This template ships a small **vendored primitive kit** in `src/lib/components/ui/`,
built on [Bits UI](https://bits-ui.com) headless primitives + Tailwind, plus
`@lucide/svelte` icons. You **own the component code** - it lives in the repo,
not a runtime dependency you are locked to - so edit it freely to fit your brand.

## The kit

One `.svelte` file per component, styled exclusively with the `primary-*` scale
and the semantic tokens (see "Dark mode" below), so every part follows the theme:

| Component                        | Import path                             | Notes                                                                                                                                                    |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                         | `$lib/components/ui/Button.svelte`      | `variant` (default, secondary, outline, ghost, destructive, link) + `size` (sm, default, lg, icon); renders a `<button>`, or an `<a>` when `href` is set |
| `Input`, `Textarea`, `Label`     | `$lib/components/ui/Input.svelte` etc.  | Native elements with `value` `$bindable`, token focus ring; forward `...rest` (name, aria, superforms bindings)                                          |
| `Card`                           | `$lib/components/ui/Card.svelte`        | `header` / `footer` snippets                                                                                                                             |
| `Dialog`, `DropdownMenu`, `Tabs` | `$lib/components/ui/Dialog.svelte` etc. | Bits UI wrappers driven by props (title/items/etc.), not exported part-by-part                                                                           |

Use them by concrete path:

```svelte
<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
</script>

<Input type="email" bind:value={email} required />
<Button type="submit" variant="destructive" disabled={busy}>{m.delete()}</Button>
```

`cn()` (`$lib/utils/cn.ts`, `twMerge(clsx(...))`) merges the variant/size class
maps with any `class` a caller passes, so overrides win without depending on
source order. A `variant` is a plain `Record<Variant, string>` map resolved
through `cn()` - no `tailwind-variants` dependency.

## No barrel files - even here

Bits UI compound primitives are normally consumed as namespaced barrels, and a
component-kit generator (shadcn-svelte) would drop an `index.ts` in every folder.
This template does **not**: the **"No barrel files"** invariant ([AGENTS.md](../AGENTS.md))
holds with no exception. Import each component from its own file path
(`$lib/components/ui/Button.svelte`), never from a re-exporting `index.ts`. If you
pull in more shadcn-svelte components, delete the generated `index.ts` and import
the concrete files.

## How it fits the rest of the template

- **Tailwind v4** - tokens are CSS custom properties in `src/app.css` under
  `@theme` / `@theme inline`, alongside `@import 'tailwindcss'` and the `.prose`
  block from [blog.md](blog.md).
- **Svelte 5 runes** - the template forces runes mode (`vite.config.ts`); the kit is
  runes-native (`$props`, `$bindable`, snippets).
- **Forms** - `Input` / `Textarea` forward `...rest` and bind `value`, so they
  drop into `sveltekit-superforms` (`bind:value={$form.title}`, `aria-invalid`,
  `name`) exactly like the raw element did (see the dashboard and notes pages).
- **Where things go** - shared UI in `$lib/components/ui/`; a component used by
  one route still lives next to that route ([AGENTS.md](../AGENTS.md) "Code
  organization").
- **Typed links** - the `svelte/no-navigation-without-resolve` lint rule wants
  `resolve()` around every internal path. For a **dynamic** route, the template
  interpolates the concrete pathname - ``resolve(`/app/notes/${id}`)`` - rather
  than the route-id form `resolve('/app/notes/[id]', { id })`; both typecheck,
  one convention keeps call sites greppable.
- **Supply chain** - `bits-ui`, `clsx`, and `tailwind-merge` go through the same
  `minimumReleaseAge` gate as everything else; `bun add` picks versions old
  enough to satisfy the policy.

## Adding more shadcn-svelte components

The kit maps cleanly onto [shadcn-svelte](https://shadcn-svelte.com) (same Bits
UI base, same `cn()` helper). To pull in one it does not ship, run
`bunx shadcn-svelte@latest add <name>`, then fold it into the template's conventions:
move each part to its own `.svelte` file, **delete the generated `index.ts`**
(no barrels), and restyle with the `primary-*` scale and semantic tokens instead
of any raw palette. Run `bun run lint && bun run check` after.

## Reactivity: `$effect` is a last resort

This template ships exactly one `$effect`: the `matchMedia` subscription in
`$lib/theme.svelte.ts` (see Dark mode). Almost everything else an effect gets
reached for is really derived state or an event handler:

- **Computing a value from other state** → `$derived` / `$derived.by`. Never
  assign to a `$state` variable from inside an `$effect` - that's the effect
  anti-pattern: the value is briefly stale, it costs an extra render, and it
  re-runs whenever any read changes, which is easy to turn into a loop.
- **Responding to a user action** → an `onclick` / form handler that does the
  work directly, not an effect watching a flag.
- **Deriving from `page` or props** → `$derived(...)`, not an effect that copies
  into local state.

`$effect` is correct only for a genuine side effect that can't be expressed as a
value: measuring the DOM, imperatively focusing a node, drawing to a canvas, or
subscribing to a non-reactive external source (return its teardown). Keep it tiny
and side-effecting only - nothing it owns should be readable as derived data.
This is an enforced convention ([AGENTS.md](../AGENTS.md) invariants).

## Styling conventions

Utility-first Tailwind is the styling system; reach for classes, not hand-written
CSS. Two rules keep it clean as the app grows:

- **Brand color has one home.** The `primary-*` scale is defined once in
  `src/app.css` under `@theme` (Tailwind v4's CSS-first config). Components use
  `bg-primary-600`, `border-primary-600`, `focus:ring-primary-500`, and so on
  for fills and borders, and `text-link` for brand-colored text - never a raw
  palette like `blue-600`. Rebrand by editing the values in `@theme`; nothing
  else changes. `check:invariants` fails on a raw `blue-` in a component.
- **Neutral color comes from the semantic tokens too.** Use `bg-background`,
  `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `border-input`, and so on - never a raw gray/white palette
  (`bg-white`, `text-gray-900`, `border-gray-200`). The `.dark` theme only swaps
  those tokens, so a raw neutral stays light and breaks dark mode. Status colors
  work the same way: `destructive`, `success`, and `warning`, tinted with opacity
  for panels and badges (`border-success/30 bg-success/10 text-success`), never
  `red-*`, `green-*` or `amber-*`. Brand-colored text (links, active tabs, icons)
  uses `text-link`, which maps to `primary-700` in light and `primary-400` in dark;
  `text-primary-*` is too dark to read on the dark theme. `check:invariants`
  enforces all three.
- **Global CSS lives only in `src/app.css`.** Today that's the Tailwind import,
  the `@theme` tokens, and the `.prose` block for rendered Markdown (blog, legal
  pages). Don't add ad-hoc `<style>` blocks or a second global stylesheet; if a
  component needs a one-off, prefer a utility class.

## Dark mode

Dark mode is cookie-based, so it also works on the prerendered marketing pages
(no Worker runs there to read a session). The pieces:

- **Tokens.** Semantic colors (`background`, `foreground`, `card`,
  `card-foreground`, `popover`, `popover-foreground`, `muted`,
  `muted-foreground`, `border`, `input`, `ring`, `destructive`,
  `destructive-foreground`, `success`, `warning`, `link`) live in `src/app.css`. `@theme inline` maps each
  `--color-<token>` to a runtime `var(--<token>)`; the raw values are defined on
  `:root` (light) and overridden under `.dark`. Use them as utilities
  (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`). The
  brand hue still has one home: `--ring` references the `--color-primary-*`
  scale. Add a new theme-aware color by defining the token in both places, never
  by hardcoding a hex per component.
- **The `dark` variant.** `@custom-variant dark (&:where(.dark, .dark *));` keys
  every `dark:` utility off a `.dark` class on `<html>`.
- **Persistence + anti-flash.** The choice (`light` | `dark` | `system`,
  default `system`) is stored in a `theme` cookie. A tiny inline script in
  `src/app.html` reads it and adds `.dark` before first paint, so there is no
  flash and it runs on prerendered assets too. No `localStorage` (invariant).
- **State + toggle.** `$lib/theme.svelte.ts` holds the reactive mode, writes the
  cookie in `setTheme`, and subscribes to `matchMedia` only while the mode is
  `system` (the sanctioned `$effect` use: a genuine external subscription).
  `$lib/components/ThemeToggle.svelte` is the affordance, placed in the
  marketing and app headers.

Every public and app surface styles its neutrals with these tokens, so the whole
chrome follows the theme; keep it that way in new components.
