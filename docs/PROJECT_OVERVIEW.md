# BidFlow — Project Overview

*Powered by TWS. Internal tool. Last updated 2026-07-02.*

---

## 1. What This Project Is

BidFlow is an internal tool that turns a pasted **Upwork job post** into a ready-to-send **proposal**, backed by evidence from TWS's own past work.

TWS is a multi-discipline service agency running four departments — Creative, Development, Marketing, SaaS — and bidding for client work primarily through Upwork. The team's portfolio of past wins (case studies, results, Loom walkthroughs, PDFs) was scattered across Google Drive, which made it slow and inconsistent to write a strong, evidence-backed proposal for every new job post. Every proposal was written from scratch, remembering (or forgetting) which past project was the best proof point for a given ask.

BidFlow fixes that by centralizing the portfolio in one searchable place and automating the match between "what this client is asking for" and "what we've already proven we can do."

## 2. The Idea

The core idea is a three-step loop:

1. **Understand the ask** — break a raw job post into the individual requirements it's actually asking for (a single post might ask for "CRM setup," "email automation," and "landing page design" all in one paragraph).
2. **Find the proof** — semantically match each requirement against a library of past case studies, even when the wording is completely different from the original write-up.
3. **Write the pitch** — assemble a proposal automatically from the matched case studies, in a tone and format the user chooses (long pitch, short Upwork message, cover letter, or cold outreach).

The bet is that most of the *thinking* in writing a good proposal — "which past project is most relevant here, and how do I phrase that convincingly" — can be automated well enough that the human's job becomes reviewing and sending, not drafting from a blank page.

## 3. Execution — How It's Built

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 18 + TypeScript | Single deployable app, no separate frontend/backend to sync |
| Styling | Tailwind CSS + hand-tuned dark theme | Fast to iterate, no design system overhead for an internal tool |
| Search/matching | `@xenova/transformers` (Transformers.js) running `Xenova/all-MiniLM-L6-v2` locally in Node | Free, no external API calls, no per-query cost, runs entirely on the Railway box |
| Storage | Flat Markdown files with YAML frontmatter (`gray-matter`) — no database | Portfolio is small (dozens, not thousands, of case studies); files are human-editable, git-diffable, and need zero ops overhead |
| Deployment | Railway, Nixpacks build, persistent volume | Matches the team's existing infra; volume keeps portfolio/engine edits across redeploys |

There is currently **no external LLM or paid AI API** in the loop (no OpenAI/Anthropic/etc. calls). All ranking is done with a local embedding model, and all proposal text is template-based — see §6 for exactly how.

### Why file-based storage instead of a database
This was a deliberate Phase-1 choice, not an oversight: the portfolio is edited rarely, read often, and small enough that indexing it in memory on each request is fast. It also means the entire dataset is portable — copy the `data/portfolio/` folder and you have the whole business's proof library in readable Markdown.

## 4. Use Case

**Primary and only use case today: internal Upwork proposal writing at TWS.**

A team member has an Upwork job post open. They:
1. Paste the job post text into BidFlow's search box.
2. Pick a proposal style (Detailed / Short Pitch / Cover Letter / Cold Outreach).
3. Get back a ranked list of matching past case studies, each with a relevance score and an explanation of *why* it matches, plus one fully synthesized proposal ready to copy.
4. Copy the proposal (or an individual case-study snippet) and paste it into Upwork.

Secondary use case: **maintaining the portfolio itself** — team members add new case studies as projects finish, so the matching pool keeps growing and future proposals get sharper.

A third, lighter use case is **tuning the matching engine** — a team member can adjust niche-detection rules, intent labels, proposal templates, and scoring weights without touching code (see §7, Engine page).

This is explicitly **not** a public-facing or multi-tenant product — there's no auth, no client accounts, no billing. It's a single internal team's workbench.

## 5. Data Model

### CaseStudy (the core entity)

```typescript
interface CaseStudy {
  id: string                    // e.g. "creative/ecommerce-brand-identity"
  title: string
  department: 'creative' | 'development' | 'marketing' | 'saas'
  service: string               // e.g. "Logo Design & Branding"
  clientNiche: string           // e.g. "E-commerce / Dropshipping"
  platform: string              // "Upwork" | "Fiverr" | "Facebook" | "Direct"
  problem: string                // client's original challenge (free text)
  solution: string               // what TWS delivered (free text)
  results: string                 // metrics / outcomes (free text)
  tags: string[]                 // keywords, boosts matching accuracy
  assets: string[]               // e.g. ["case_study", "loom", "images", "slides"]
  caseStudyLink: string           // Google Drive PDF link
  loomLink: string                // Loom walkthrough link
  dateAdded: string
}
```

Stored as one Markdown file per case study at `data/portfolio/<department>/<slug>.md`, YAML frontmatter for structured fields, Markdown body for the Problem/Solution/Results narrative. Currently ~28 case studies live across the four departments (Marketing and SaaS are the most fleshed out; Creative and Development are thin).

### Engine config (`data/engine.json`)

A separate, editable config drives all matching/writing behavior:
- **Niches** — 15 regex rules that detect industry (e.g. "dental|dentist" → "Dental") to personalize the proposal hook.
- **Intent labels** — 19 priority-ordered regex rules that label a detected requirement (e.g. "CRM setup," "Meta Ads," "Landing pages").
- **Styles** — 4 proposal templates (see §6).
- **Scoring weights** — the formula used to rank matches (see §6).

## 6. Engine Behavior — How Matching and Generation Actually Work

This is the heart of the product. Given a pasted job post, here's the exact pipeline (`lib/search.ts`):

### Step 1 — Intent extraction
The raw text is split into sentences, then further split on connectors like commas, "and also," "along with," etc. Each resulting chunk is filtered to 4–50 words, deduplicated, and capped at the top 10 chunks. This turns one messy paragraph into a list of discrete "asks" — e.g. a post asking for "a CRM setup, email automation, and a new landing page" becomes three separate intents to match independently.

### Step 2 — Embedding & matching
Each intent is converted into a 384-dimension vector using the local `all-MiniLM-L6-v2` model (no network call — it runs in-process). Cosine similarity is computed against every case study in the portfolio index. For each intent, the top 3 case studies with similarity > 0.2 are kept. The full portfolio index is cached in memory and rebuilt on writes (5-minute TTL), so search stays fast without hitting disk every time.

### Step 3 — Score aggregation
A case study can match multiple intents (a strong sign of relevance). Results are grouped by case study, and a final score is computed:

```
final = (avgCosine × 0.45) + (maxCosine × 0.30) + (frequencyBonus × 0.25)
frequencyBonus = min(intentCount / 4, 0.15)
```

Results below a 30% minimum score are dropped. The top 6 case studies are returned, sorted by score then by how many intents they matched.

### Step 4 — Proposal synthesis
The system also scans the raw job post text for signals — client niche, urgency language, "proof-seeking" phrasing (e.g. "show me examples"), budget-consciousness — using regex heuristics. It then assembles a proposal from the chosen style's template:
- **Hook** — niche-specific opening line
- **Proof blocks** — 0–3 blocks of case-study evidence, pulled from the top matches, worded from the `solution`/`results` fields
- **CTA** — one of 4 call-to-action variants chosen based on detected client signals (default / proof-seeking / urgency / budget-conscious)
- **Assets** — Loom and case-study links appended if the style includes them and the case study has them

If the assembled text would exceed the style's word cap, lower-priority proof blocks are dropped rather than truncating mid-sentence.

### The 4 proposal styles

| Style | Length | Proof blocks | Use case |
|---|---|---|---|
| Detailed | 180–220 words | up to 3 | Full Upwork proposal |
| Short Pitch | 100–130 words | 1 | Quick Upwork message |
| Cover Letter | 150–180 words | 2 | Narrative tone |
| Cold Outreach | 80–100 words | 0 | DM / email, no long proof |

**Important nuance:** nothing here is generative AI writing prose from scratch. Every word comes from a template with `{variables}` filled in from the matched case study's own fields (`solution`, `results`, `niche`, etc.) or from fixed CTA copy. This makes output predictable and always traceable back to a real past project — but it also means proposal *phrasing* is only as good as what's written into each case study's Problem/Solution/Results fields.

## 7. Current Features

- **Search page (`/`)** — paste a job post, pick a style, get ranked case-study matches + one synthesized proposal, one-click copy to clipboard (whole proposal or individual result snippets).
- **Portfolio page (`/portfolio`)** — browse, filter (by department/title/service/niche/tag), add, and delete case studies. No in-place edit yet — editing means delete + re-add.
- **Engine page (`/engine`)** — tune the matching/writing behavior without touching code: edit niche-detection regexes, intent-label rules, proposal style templates, and scoring weights, with a live test-phrase bar to check regex matches before saving.
- **Cross-platform dev tooling** — `npm run dev` auto-kills anything already bound to port 3000 on both macOS/Linux and Windows before starting.
- **Railway deployment** — persistent volume seeding so portfolio/engine edits survive redeploys; error logging fixed recently so a broken search returns a real error instead of a silent 500.

## 8. Data Flow, End to End

```
Upwork job post (manual paste)
        │
        ▼
 [Intent extraction]  → splits into discrete requirement chunks
        │
        ▼
 [Embedding model]    → each intent → 384-dim vector (local, no API call)
        │
        ▼
 [Similarity search]  → cosine similarity vs. portfolio index (in-memory)
        │
        ▼
 [Score aggregation]  → per-case-study score, top 6 kept
        │
        ▼
 [Signal detection]   → niche / urgency / proof-seeking / budget cues from raw text
        │
        ▼
 [Template assembly]  → hook + proof blocks + CTA + assets, per chosen style
        │
        ▼
 Final output: synthesized proposal (plain text) + ranked result cards
        │
        ▼
 User copies to clipboard → pastes into Upwork
```

## 9. Final Output

The output is **plain text**, copyable to clipboard — there is no PDF/document export yet. Two copy actions exist:
1. **Copy full proposal** — the complete synthesized pitch (hook → proof → CTA → asset links).
2. **Copy snippet** — an individual case study's proof block, for manually assembling a custom pitch.

Example shape of a generated proposal:

```
{hook — niche-specific intro}

{proof block 1 — from best-matched case study}
{proof block 2}
{proof block 3}

{CTA — tailored to detected urgency/budget/proof-seeking}

🎥 Loom — https://loom.com/…
📄 Case Study — https://drive.google.com/…
```

## 10. Automation Today vs. Planned

**Automated today:**
- Requirement extraction from raw text
- Semantic matching against the portfolio (local model, zero API cost)
- Proposal assembly from templates
- Niche/urgency/budget signal detection

**Manual today:**
- Getting the job post text into the app (copy-paste from Upwork)
- Adding/updating case studies in the portfolio
- Final review and send

**Planned automation (confirmed direction, not yet built):** auto-fetching job posts directly from Upwork via the **Upwork Jobs API**, removing the copy-paste step entirely. A full onboarding/spec doc for this already exists in the repo (`UPWORK_API_ONBOARDING_GUIDE.md`) covering OAuth 2.0, rate limits (~300 req/min, ~40k/day), and query examples — but the integration itself is not implemented and Upwork API access has not yet been approved.

## 11. Remaining Work

Roughly in priority order based on what would unblock daily use vs. what's a nice-to-have:

| Item | Status | Impact |
|---|---|---|
| Upwork Jobs API integration (auto-fetch job posts) | Spec written, not built, pending API approval | Removes the manual paste step — the single biggest friction point today |
| In-place case study editing | Not built (workaround: delete + re-add) | Portfolio maintenance is clunky as it grows |
| Bulk import for case studies | `scripts/import-portfolio.js` exists but isn't wired into the app UI | Faster to backfill a large existing project archive |
| PDF/document export of proposals | Not built (text-only today) | Some team members may want a formatted document instead of raw text |
| Search history / saved queries | Not built | Can't revisit or reuse a past search without re-pasting |
| Portfolio depth | Creative (1) and Development (1) departments are very thin vs. Marketing (13) and SaaS (13) | Matching quality for those two departments is currently weak |
| Model cold-start on Railway | First request after deploy downloads ~80MB model; recently got real error logging but no pre-warming | Occasional slow/failed first search after a redeploy |

## 12. Possible New Features (Brainstorm)

These aren't committed — they're gaps and opportunities visible from the current architecture, worth discussing:

- **Upwork Jobs API auto-fetch** *(already planned — see §10)* — turns this from "paste-and-search" into "browse-and-one-click-propose."
- **Win/loss tracking** — log which generated proposals actually won the job, and feed that back into scoring (case studies that correlate with wins get ranked higher over time).
- **In-place case study editor** — straightforward UI addition, removes the delete+re-add workaround.
- **Proposal history** — save every generated proposal against the job post it was for, so the team can see what was actually sent and audit tone/quality over time.
- **A/B-able CTA variants** — since CTAs are already templated by signal type, track which CTA variant correlates with wins per niche.
- **Lightweight LLM pass (optional, opt-in)** — use a model only to *smooth transitions* between template-assembled blocks (not to invent content), keeping the "always traceable to real proof" guarantee while reducing the templated feel.
- **Department depth-balancing prompt** — surface a nudge in the Portfolio page when a department has too few case studies to produce confident matches, encouraging the team to log more Creative/Development wins.
- **Multi-user attribution** — track which team member wrote/sent a given proposal, useful once more than one person is bidding regularly.
- **Export to Upwork-ready formatting** — since Upwork strips some formatting, a "plain vs. rich" toggle on copy could save manual cleanup.

## 13. Known Limitations (Be Upfront About These)

- No authentication — anyone with access to the deployed URL can view/edit the portfolio and engine config. Fine for a small internal team, worth reconsidering if the team grows.
- No database — scales fine for tens of case studies, would need rethinking well before hundreds.
- Proposal text is 100% template-driven — quality is bounded by how well each case study's Problem/Solution/Results fields are written, not by any generative model.
- Single environment, single tenant — this is explicitly a TWS-internal Upwork tool, not a multi-client SaaS product.

---

## Open Questions for You

A few things worth pinning down before this doc is "final":

1. **Portfolio depth** — is backfilling Creative/Development case studies already planned, or should that be flagged as a real gap in the roadmap?
2. **Win/loss tracking** — is there any existing way (spreadsheet, Upwork dashboard) the team tracks which proposals actually won jobs? If so, that's the natural next data source to wire in.
3. **Team size** — is BidFlow used by one person or several? This affects whether "no auth / no attribution" is a real gap worth prioritizing.
4. **Upwork API timeline** — do you have a rough date/status on the API approval, or is it indefinitely pending?
