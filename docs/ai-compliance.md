# AI transparency & compliance

AI is **opt-in** here - no AI endpoint ships ([cloudflare.md](cloudflare.md#ai-opt-in)). The moment you add an AI feature you inherit obligations that depend on _what_ the AI does and _which markets_ you serve. This page summarizes the common ones and what the template gives you to meet them.

> **Not legal advice.** Like the [legal pages](<../app/src/routes/(marketing)>), this is a starting point, not a compliance sign-off. Dates, thresholds, and duties change and are jurisdiction-specific - have counsel review against your actual product and markets before you ship AI.

## What the template gives you

- **`AiDisclosure` component** (`$lib/components/ai/AiDisclosure.svelte`) - a translatable notice that tells users they're interacting with an AI. Drop it into every AI chat/assistant surface. This covers the core "disclose that it's AI" duty below.
- This guide and the checklist at the end.

You still add: an AI section in your privacy policy, and labeling of AI-generated content (patterns below).

## EU - the AI Act (Regulation 2024/1689)

Risk-based. Most SaaS AI (a support chatbot, content generation) is **limited risk**, whose main duty is **transparency (Article 50)**:

- **Chatbots / AI that interacts with people** - tell users they're dealing with an AI system, unless it's obvious. → render `AiDisclosure`.
- **AI-generated or manipulated content** (text, image, audio, video) - mark it as artificially generated in a machine-readable way _and_ disclose it to viewers. Deepfakes and AI-authored text on matters of public interest have explicit labeling duties.
- **Emotion recognition / biometric categorization** - inform the people exposed to it.

The other tiers, briefly:

- **Prohibited (Art. 5)** - don't build them: social scoring, manipulative or exploitative systems, untargeted scraping of facial images, most real-time remote biometric identification. In force since Feb 2025.
- **High-risk (Annex III)** - AI used for hiring, credit, essential services, biometrics, etc. Heavy duties (risk management, data governance, logging, human oversight, conformity assessment, EU registration). If your feature lands here it's a project, not a checkbox.
- **GPAI models** - if you _provide_ or fine-tune a general-purpose model you take on provider duties (since Aug 2025). Calling a third-party model API makes you a **deployer**, with lighter duties.

Timeline: prohibitions Feb 2025 · GPAI + governance Aug 2025 · most high-risk Aug 2026 (some 2027). Fines reach €35M or 7% of global turnover for prohibited-use breaches. Official text: <https://eur-lex.europa.eu/eli/reg/2024/1689/oj>.

## United States - no single federal act

What actually applies is a patchwork; the baseline that keeps you clear in most states is the same as the EU transparency duty plus "don't deceive":

- **FTC Act §5** (federal) - don't misrepresent what your AI does, don't use it deceptively or unfairly, and substantiate AI claims in your marketing.
- **California SB 1001 (bot disclosure)** - disclose when a bot interacts with people in a commercial or electoral context. → `AiDisclosure`.
- **California AI Transparency Act (SB 942)** (2026) - large generative-AI providers must offer detection tooling and provenance/latent disclosures on AI output.
- **Colorado AI Act (SB 205)** (2026) - duties for "high-risk" AI in consequential decisions (employment, lending, housing…): reasonable care against algorithmic discrimination, plus consumer notice.
- **Utah AI Policy Act** - disclose that a consumer is interacting with generative AI (proactively in regulated professions, on request otherwise).
- **NYC Local Law 144** - bias audit + notice for automated hiring tools. **Illinois BIPA** and similar laws if you process biometrics.

## Data protection still applies

AI that touches personal data is still governed by **GDPR** (EU) and **CCPA/CPRA** (California) and friends: have a legal basis, limit purpose, sign a data-processing agreement with your model provider, and don't let outputs train on user data unexpectedly. Document it in your privacy policy.

## Checklist - before you ship an AI feature

- [ ] Render `<AiDisclosure />` on every AI chat/assistant surface.
- [ ] Label AI-generated content visibly, and machine-readably where required (e.g. a `data-ai-generated` attribute, or C2PA/provenance metadata for media).
- [ ] Add an **AI** section to your privacy policy: which models/providers, what data they process, that outputs are AI-generated, and how to reach a human.
- [ ] Keep a human in the loop for anything consequential (hiring, credit, access) - and never ship a prohibited use.
- [ ] Substantiate any AI claims in marketing copy.
- [ ] Re-check the rules for your actual markets with counsel; the dates and thresholds above move.
