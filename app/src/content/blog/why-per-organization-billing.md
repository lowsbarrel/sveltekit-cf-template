---
title: Why sveltekit-cf-template bills per organization
description: Subscriptions belong to the team, not the individual - here's why that choice matters and how the plans fit together.
date: 2026-07-12
author: The sveltekit-cf-template team
category: Architecture
draft: false
---

The template scopes every subscription to an **organization**, not a user. Each person who
signs up gets a personal organization automatically, so a solo founder and a 50-person
team use the exact same billing path.

## The free tier is a real tier

Everyone starts on **Free**. It isn't a locked demo - it's a plan with its own limits,
enforced the same way paid limits are. When an organization hits a cap, the service
throws a `limit_reached` error and the UI can prompt an upgrade.

## Upgrading is one checkout away

Paid plans map to Creem products. Because Creem is the Merchant of Record, it hosts the
payment page, collects the right tax for the buyer's country, and handles chargebacks -
none of that touches your Worker.

> Add a plan by editing `$lib/plans.ts`, wiring its Creem product id, and setting its
> limits. The pricing page and quota checks pick it up automatically.

See `docs/plans.md` for the full walkthrough, including free trials and adding new limits.
