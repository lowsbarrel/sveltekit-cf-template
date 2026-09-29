---
title: Welcome to sveltekit-cf-template
description: A file-based Markdown blog, prerendered at the edge - how it works and how to write your first post.
date: 2026-07-14
author: The sveltekit-cf-template team
category: Guides
draft: false
---

This post is a plain Markdown file at `src/content/blog/welcome-to-sveltekit-cf-template.md`. Drop a
new `.md` file in that folder with the frontmatter block at the top, and it shows up
here - no database, no CMS, no build step to remember.

## How it works

At build time, the template reads every file in the blog folder, parses the frontmatter and
Markdown, and **prerenders each post to static HTML**. The pages are served straight
from Cloudflare's edge without ever invoking the Worker, so they cost nothing per view
and load instantly.

## Writing a post

Every post needs a frontmatter block:

```md
---
title: My post
description: One sentence for SEO and the index card.
date: 2026-07-14
author: Your Name
draft: false
---

Your **Markdown** goes here.
```

Set `draft: true` while you're working - drafts are visible in `bun run dev` but never
ship to production.

## What you get

- Automatic listing on `/blog`, newest first
- Per-post SEO tags and Article structured data
- Inclusion in `sitemap.xml`
- Fully responsive, mobile-first typography

That's it. Delete these sample posts and write your own.
