# TWS Proposal Generator — Requirements Document

**Project:** Smart Portfolio Matcher & Proposal Generator  
**Owner:** CEO, TWS  
**Services:** Marketing, SaaS, Design, Development  
**Platforms:** Upwork, Fiverr, Facebook, Direct  
**Last Updated:** 2026-06-23  
**Status:** Planning Phase

---

## 1. Problem Statement

When a client sends a query or job post, the CEO needs to quickly find the most relevant past work from TWS portfolio and craft a targeted proposal. Currently portfolio data is scattered across Google Drive (PDFs, images, PPTs, Loom recordings) making it slow and inconsistent to reference during proposal writing.

---

## 2. Goal

Build a hosted web app (Railway) where:
- Portfolio case studies are stored as structured `.md` files on the server
- Pasting a client query surfaces the most relevant case studies
- Output helps draft a faster, more targeted proposal
- Accessible from any device via browser — no installation required
- Future API integration with internal ERP (Workly) planned

---

## 3. Departments

| Department   | Services Covered                          |
|--------------|-------------------------------------------|
| Creative     | Logo, Branding, UI/UX, Graphics, Slides   |
| Development  | Web Apps, SaaS, Websites, Automation      |
| Marketing    | SEO, Ads, Content, Social Media, Funnels  |
| SaaS         | SaaS Products, Integrations, Tools        |

---

## 4. Core Features

### 4.1 Portfolio Entry Form (Add / Edit Case Studies)
- Form UI inside the app
- On submit, generates a structured `.md` file saved to server
- Fields:
  - `Title` — Project name
  - `Department` — Creative / Dev / Marketing / SaaS
  - `Service Type` — e.g. Logo Design, Web App, SEO Campaign
  - `Client Niche` — e.g. E-commerce, Real Estate, SaaS Startup
  - `Platform` — Upwork / Fiverr / Facebook / Direct
  - `Problem` — What the client came with (free text)
  - `Solution` — What TWS delivered (free text)
  - `Results` — Metrics and outcomes (free text)
  - `Tags` — Keywords for better matching (comma-separated)
  - `Case Study Link` — Google Drive link to PDF/PPT/images
  - `Loom Link` — Demo/walkthrough video link
  - `Assets Available` — Checkboxes: [ ] Case Study  [ ] Loom  [ ] Images  [ ] Slides

### 4.2 Semantic Search (Client Query Matching)
- Input: paste raw client query / job description
- Searches all `.md` files using semantic similarity (Transformers.js)
- Returns ranked list of matching case studies

### 4.3 Search Output (per match)
- **Match Title** — Project name + department
- **Relevance Score** — e.g. 92% match
- **Why It Matches** — Short explanation of relevance
- **What to Highlight** — Specific points to emphasize for this client
- **Available Files** — Shows which assets exist with clickable links:
  - `[Case Study PDF]` — opens Google Drive link
  - `[Loom Recording]` — opens Loom link
  - `[Images]` / `[Slides]` if available
- **Draft Proposal Snippet** — Template-filled pitch paragraph using match data

### 4.4 Proposal Draft Output
- Auto-filled from matched case study fields
- Format: short paragraph (3-5 sentences)
- Copyable with one click
- Template-based (Phase 1)
- Local LLM via Transformers.js for richer drafts (Phase 2)

---

## 5. Data Architecture

### 5.1 Storage Format
- Each case study = one `.md` file
- Stored on server: `/data/portfolio/[department]/[slug].md`
- YAML frontmatter for structured fields + markdown body for narrative
- Persisted via Railway Volume (survives redeployments)

### 5.2 Example `.md` File Structure
```markdown
---
title: E-commerce Brand Identity
department: Creative
service: Logo Design & Branding
client_niche: E-commerce / Dropshipping
platform: Upwork
tags: [branding, logo, identity, e-commerce]
assets: [case_study, loom, images]
case_study_link: https://drive.google.com/...
loom_link: https://loom.com/...
date_added: 2026-06-23
---

## Problem
Client needed a complete brand identity for their dropshipping store targeting US buyers.

## Solution
Delivered full logo suite, color palette, typography guide, and brand guidelines document.

## Results
Client landed 3 partnership deals within 2 weeks of the rebrand. 5-star review on Upwork.
```

### 5.3 Search Index
- Library: `@xenova/transformers` (Transformers.js) — runs in Node.js, no Python needed
- Model: `all-MiniLM-L6-v2` (~80MB, downloads once on first run)
- Index rebuilt automatically when new `.md` files are added
- Index cached in memory during server session

---

## 6. Tech Stack

| Layer        | Technology                              | Reason                                      |
|--------------|-----------------------------------------|---------------------------------------------|
| Backend      | Node.js + Express                       | Matches Workly stack, easy future integration|
| Frontend     | Next.js                                 | Matches Workly stack                        |
| Search       | Transformers.js (`@xenova/transformers`)| Free, JS-native, semantic, no Python needed |
| Storage      | `.md` files + Railway Volume            | Human-readable, persistent on server        |
| Hosting      | Railway (existing account)              | Already set up, free tier sufficient        |
| AI Drafts    | Transformers.js local model (Phase 2)   | No paid API, runs on server                 |

---

## 7. Phases

### Phase 1 — Core App (Build Now)
- [ ] Project scaffold (Next.js + Express API)
- [ ] Portfolio entry form → generates `.md` files on server
- [ ] Semantic search engine (Transformers.js)
- [ ] Search results UI with scores + asset file indicators
- [ ] Template-based proposal draft output (copy to clipboard)
- [ ] Deploy to Railway

### Phase 2 — Enhancements
- [ ] Local LLM integration for AI-written proposal drafts
- [ ] Edit / delete existing case studies from UI
- [ ] Bulk import from CSV
- [ ] Export matched results as PDF
- [ ] Search history / saved queries

### Phase 3 — Workly Integration
- [ ] Expose REST API endpoints from Proposal Generator
- [ ] Workly calls API with client query, gets back matched portfolios
- [ ] Auth handshake between Workly and Proposal Generator (JWT or API key)
- [ ] Display proposal suggestions inline inside Workly

---

## 8. Out of Scope (Phase 1)

- Auto-parsing PDFs, images, PPTs from Google Drive
- Paid AI API usage
- Mobile-native app
- Workly integration (Phase 3)
- Multi-user / team access

---

## 9. Decisions Log

| Date       | Question                                         | Decision                                        |
|------------|--------------------------------------------------|-------------------------------------------------|
| 2026-06-23 | Use paid AI API?                                 | No — local models only (Transformers.js)        |
| 2026-06-23 | Database or flat files?                          | Flat `.md` files on server                      |
| 2026-06-23 | Manual data entry or auto-import?                | Form UI that generates `.md` files              |
| 2026-06-23 | Output format for matched assets?                | Show Case Study + Loom links inline per result  |
| 2026-06-23 | Local app or hosted?                             | Hosted on Railway (Option A) — multi-device     |
| 2026-06-23 | Tech stack?                                      | Node.js + Express + Next.js (matches Workly)    |
| 2026-06-23 | Workly integration?                              | Phase 3 — REST API + auth handshake             |
| 2026-06-23 | Data persistence on Railway?                     | Railway Volume (persistent disk)                |

---

## 10. Notes

- Railway account already exists — no new account setup needed
- Workly uses Node/Express + Next.js — Proposal Generator mirrors this for easy future merge
- Workly has existing auth system — Phase 3 integration must respect it (details TBD)
- Drive links and Loom links stored as references — files stay in Google Drive
- App accessible from any device via browser — no installation needed on client machines
