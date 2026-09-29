# Blog

A file-based Markdown blog, prerendered to static HTML and served from Cloudflare's edge without ever invoking the Worker - so posts cost nothing per view and load instantly.

## Where posts live

One Markdown file per post in `src/content/blog/*.md`. The filename is the URL slug (`hello-world.md` → `/blog/hello-world`). Each file starts with a frontmatter block:

```md
---
title: My first post
description: One sentence - used for the index card, the SEO meta description, and OG tags.
date: 2026-07-14
author: Your Name
category: Guides
draft: false
---

Your **Markdown** body. Headings, lists, code blocks, blockquotes, images - all styled.
```

- `title`, `description`, `date` (ISO `YYYY-MM-DD`) are used everywhere. `author` and `category` are optional.
- `category` shows as a badge and drives the index filter (client-side - the index is prerendered with every post, so filtering works without a server round-trip and the full list is still in the crawlable HTML).
- `draft: true` keeps a post visible in `bun run dev` but out of the production build.

## How it renders

`$lib/blog.ts` loads every post at build time (`import.meta.glob`), parses the frontmatter, and converts the body with [`marked`](https://marked.js.org/). The routes under `src/routes/(marketing)/blog/` are `prerender = true`, so this all runs once at build:

- `/blog` - the index, newest first (`+page.server.ts` + `+page.svelte`).
- `/blog/[slug]` - a post. `entries()` lists every slug so the prerenderer emits them all.

Posts are automatically added to `sitemap.xml`, get per-post `<title>`/description/OG tags, and emit `BlogPosting` structured data (`articleJsonLd`).

## Styling

Rendered Markdown is wrapped in a `.prose` container styled in `src/app.css` - mobile-first: code and `<pre>` blocks scroll instead of overflowing, images never exceed the column. Adjust the `.prose` rules to taste; there's no CSS framework plugin to learn.

## Add a post

1. Create `src/content/blog/my-post.md` with the frontmatter above.
2. `bun run dev` and open `/blog` - it's already there.
3. Set `draft: false` when you're ready to ship; commit and deploy.

## The `{@html}` note (security)

Posts are rendered with `{@html post.html}`. That is safe **because the content is trusted** - you author the Markdown files and commit them. This is the one deliberate exception to the "no `{@html}`" rule in [AGENTS.md](../AGENTS.md).

If you ever render Markdown from an **untrusted** source (user submissions, comments), sanitize the HTML first - add a sanitizer such as [`dompurify`](https://github.com/cure53/DOMPurify) (or configure `marked` with a sanitizing step) before it reaches `{@html}`. Don't skip this: untrusted Markdown can carry `<script>` and event-handler attributes.

## Want Svelte components in posts?

This setup is plain Markdown by design (lean, no `svelte.config.js`). If you later need interactive components inside posts, swap `marked` for [`mdsvex`](https://mdsvex.pngwn.io/) - it compiles Markdown to Svelte components, at the cost of a `svelte.config.js` and the remark/unified dependency tree.
