# TP Radar v2 — Platform Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Sub-project B — transform TP Radar from a local Claude Code pipeline + static site into a server-side AI analysis platform with web interface.

---

## 1. Context & Goals

### Current state
- Static site on GitHub Pages (vanilla HTML/CSS/JS)
- Data in a single `companies.json` file — no backend, no database
- Pipeline = 644-line Claude Code skill (`/analyze`) run manually on developer's machine
- 3 analyzed companies, reports as standalone HTML files

### Target state
- Web application where a user submits a company name
- Server-side AI pipeline: scrapes e-KRS → extracts data → analyzes risks & opportunities → generates report
- Live progress visible in browser
- Dynamic report with short/full toggle, drill-down per section, export to PDF/HTML
- MVP for a team of 5-20 users, architecture ready to scale to 500+

### Constraints
- Analysis cost budget: $1-5 per company (estimated ~$0.85 in API tokens)
- Analysis time: 10-15 minutes max
- AI-driven pipeline (Claude API with tool use) — not deterministic rules
- New repository — current tp-radar is reference/prototype only

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    USER (browser)                     │
│              React + Vite + TailwindCSS              │
└──────────┬──────────────────────▲────────────────────┘
           │ POST /analyze       │ SSE /analyze/{id}/stream
           │ GET /reports/{id}   │
           ▼                     │
┌──────────────────────────────────────────────────────┐
│                  FastAPI (backend)                     │
│                                                       │
│  ┌─────────┐   ┌──────────┐   ┌───────────────────┐ │
│  │ API     │──▶│ Job      │──▶│ Pipeline Worker   │ │
│  │ Routes  │   │ Queue    │   │                   │ │
│  └─────────┘   └──────────┘   │ Phase 1: Scrape   │ │
│                               │ Phase 2: Extract   │ │
│       ┌───────────┐          │ Phase 3: Score     │ │
│       │PostgreSQL │◀─────────│ Phase 4: Report    │ │
│       └───────────┘          └───────────────────┘ │
└──────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
     Company data,              Claude API
     reports, jobs              (Anthropic)
```

### Key decisions
- **Monorepo** — `frontend/` and `backend/` in one repo. Simpler for a single developer.
- **Job queue** — MVP uses `asyncio` background tasks in FastAPI with state persisted in PostgreSQL. Swap to Celery + Redis when >20 concurrent analyses needed (~1 day of work).
- **SSE (Server-Sent Events)** — backend streams progress events. Simpler than WebSocket, sufficient for step-by-step updates.
- **Separate from current repo** — new project, current tp-radar as reference only.

---

## 3. Pipeline Worker — 4 Phases

### Phase 1: Scraping + Parsing (deterministic first, AI fallback)
Progress: 0% → 25%

```
1a. KRS lookup
    - Primary: rejestr.io API (structured JSON)
    - Fallback: WebSearch

1b. e-KRS Playwright (headless Chromium)
    - Download all documents from most recent financial year
    - Save to temporary storage

1c. Document classification & parsing
    - XML/XHTML (sprawozdanie) → BeautifulSoup → structured financial data
      (iXBRL tags give us direct extraction — use this first)
    - PDF (text-based) → pdfplumber → text + tables
    - PDF (scanned) → auto-detect (<50 chars/page = scan) → OCR (Tesseract)

    AI FALLBACK: If deterministic parsing fails or produces incomplete results
    (e.g., malformed XML, unusual PDF layout, tables not extractable by pdfplumber),
    send the raw document content to Claude API with extraction instructions.
    This costs extra tokens but prevents pipeline failure on edge cases.

1d. Online research (parallel with 1b-1c)
    - Company IR website
    - Parent/group profile
    - Press articles, stock exchange communications (if GPW-listed)
    - KRS online — board composition, connections, history

    Output:
    - Structured data (from XML/parsing)
    - FULL TEXT of all documents (for deep analysis in Phase 2)
    - Online research text with metadata (source, retrieval date)
```

### Alternative input: Manual upload (fallback)

When e-KRS is unavailable or scraping fails, users can upload PDF/XML files directly
via drag & drop in the web UI. Uploaded files enter the pipeline at Phase 2 (same
extraction flow). This ensures the product works even without automated scraping.

Upload accepts: XML/XHTML (sprawozdanie), PDF (informacja dodatkowa, sprawozdanie
zarządu). Files are validated for format before processing.

**Important:** Phase 1 preserves BOTH structured extractions AND full document text.
Structured data is the backbone; full text enables Phase 2 to find insights
that no template anticipated. The depth of analysis is the product's value —
this is not a form-filling engine.

### Phase 2: Extraction + Deep Reading (Claude API, prompt 1)
Progress: 25% → 60%

```
System prompt: financial analyst persona
Input:
  - Structured data from XML parsing (backbone — numbers, tags)
  - FULL TEXT of all documents (informacja dodatkowa, sprawozdanie zarządu, etc.)
  - Online research results
  - User's custom focus areas (if provided — see "User Prompt Injection" below)
Tools:
  - save_financials(year, revenue, ebit, ...)
  - save_tp_transactions(entity, amount, type, ...)
  - save_tax_profile(etr, deferred_tax, ...)
  - save_mgmt_report(strategy, risk_flags, ...)
  - save_group_structure(entities, relationships, ...)
  - flag_data_gap(field, reason)         ← quality gate
  - add_insight(category, observation, evidence) ← model's reasoning space
```

**Key design principle:** The model receives BOTH structured data AND full document text.
Structured data fills the template efficiently. Full text enables the model to:
- Catch nuances in accounting notes that no template field covers
- Read between the lines of management commentary
- Connect information across different documents
- Identify company-specific patterns that generic fields miss

The perceptiveness and depth of this analysis is the core product value.

`add_insight()` lets the model record observations beyond the template. These flow into Phases 3-4.

Extraction template, prompt persona, and quality gates to be designed in detail during implementation (separate design session per phase).

### Phase 3: Scoring + Risk/Opportunity Assessment (Claude API, prompt 2)
Progress: 60% → 80%

```
System prompt: tax advisor persona with analytical framework
Input: structured data from Phase 2
Approach: small set of deterministic rules as baseline +
          significant model freedom to identify case-specific risks/opportunities
Tools:
  - add_risk(name, category, level, amount, description, reasoning)
  - add_opportunity(name, category, description, reasoning)
  - set_category_score(category, score, justification)
  - set_overall_score(score, level, justification)
```

Categories: open string — "tp", "cit", "vat", "ip_box", "custom", and any future domain including non-tax business analysis.

Prompt design, persona, and rule balance to be refined during implementation.

### Phase 4: Report Generation — Multi-Agent Review (Claude API, 3 prompts)
Progress: 80% → 100%

This phase uses a **write → review → revise** workflow with multiple agents:

```
Step 4a — WRITER AGENT
  System prompt: report writer persona with style guide
  Input: complete data + scoring from Phases 2-3 + user's custom focus (if any)
  Output: Markdown per section
  Tools:
    - write_section(key, title, summary_md, full_md)
    - write_custom_section(title, summary_md, full_md, after_key)
    - write_user_answer(question, answer_md) ← response to user's custom prompt

Step 4b — REVIEWER AGENT (single reviewer, combined scope)
  Reviewer checks BOTH: domain accuracy (tax/TP claims correct, risks properly assessed)
  AND quality/clarity (writing clear, professional, well-structured)
  Input: draft report sections + source data (for fact-checking)
  Output: structured feedback per section (approve / revise with comments)

Step 4c — WRITER AGENT (revision pass)
  Input: original draft + reviewer feedback
  Output: final report sections
  Only revises sections that received "revise" feedback.
```

**Cost impact:** ~2x token cost for Phase 4 (~$0.60 instead of ~$0.30). Acceptable because:
- It's only text (not large document processing)
- Report quality is the user-facing deliverable — this is where quality matters most
- Total analysis cost still well within $1-2 budget

Model generates both SUMMARY and FULL variants of each section. Custom sections for company-specific topics.

Report style guide and golden standard to be developed during implementation.

### User Prompt Injection (optional personalization)

When triggering an analysis, the user can optionally provide a custom prompt:

> "Szczególnie interesuje mnie polityka cash poolingu i czy stopy procentowe są rynkowe.
> Sprawdź też czy ta spółka kwalifikuje się do IP Box."

This text is:
1. Stored in `analyses.user_prompt` (new field)
2. Injected into Phase 2 system prompt as additional focus area
3. Injected into Phase 3 for targeted risk/opportunity identification
4. Injected into Phase 4 — writer generates an additional section: **"Odpowiedź na Twoje pytanie"**
   with a direct, targeted response to the user's specific questions

Without a custom prompt, the full standard analysis runs normally. The custom prompt
adds depth in the user's area of interest — it doesn't replace the standard analysis.

### Why 4 phases, not one prompt
1. Phase 1 needs no AI — saves tokens ($)
2. Extraction (facts) separated from scoring (judgment) — like audit: gather evidence, then form opinion
3. Report writing is a different skill than data analysis — separate prompt = better style control
4. Cost control — if Phase 1 fails (e-KRS down), zero API spend

### Token cost estimate per analysis
| Phase | Input tokens | Output tokens | ~Cost |
|-------|-------------|---------------|-------|
| Phase 1 (AI fallback, if needed) | ~10k | ~2k | ~$0.10 |
| Phase 2 (extraction + deep reading) | ~40k | ~8k | ~$0.55 |
| Phase 3 (scoring) | ~15k | ~5k | ~$0.25 |
| Phase 4a (report writing) | ~20k | ~10k | ~$0.35 |
| Phase 4b (1 reviewer) | ~15k | ~2k | ~$0.15 |
| Phase 4c (revision) | ~15k | ~5k | ~$0.15 |
| **Total** | | | **~$1.55** |

Estimate revised upward from $0.85 to ~$1.55 due to: full-text analysis (more input tokens),
multi-agent review loop, and AI fallback for parsing. Still well within $1-5 budget.

---

## 4. Data Model (PostgreSQL)

```sql
-- Companies (reusable across analyses)
companies:
  id          UUID PK
  slug        UNIQUE -- "wb-electronics"
  name        TEXT   -- "WB Electronics S.A."
  krs         TEXT   -- "0000369722"
  created_at  TIMESTAMP
  updated_at  TIMESTAMP

-- One company can have many analyses (re-runs, different years)
analyses:
  id                UUID PK
  company_id        FK → companies
  user_id           FK → users (nullable in MVP, required later)
  status            ENUM pending/running/done/failed
  current_phase     ENUM scraping/extracting/scoring/writing
  progress_pct      INT (0-100)
  progress_message  TEXT -- "Pobieram dokumenty z e-KRS..."
  financial_year    INT -- 2024
  started_at        TIMESTAMP
  completed_at      TIMESTAMP
  error_message     TEXT (nullable)
  cost_usd          DECIMAL (nullable)
  user_prompt       TEXT (nullable) -- optional custom focus/questions from user

-- Structured data extracted by Phase 2
extracted_data:
  analysis_id       FK → analyses (PK)
  financials        JSONB
  financials_prev   JSONB
  cost_structure    JSONB
  tp_transactions   JSONB
  tax_profile       JSONB
  mgmt_report       JSONB
  group_structure   JSONB
  online_research   JSONB -- web research results, separate from document data
  insights          JSONB -- model's free-form observations
  raw_documents     JSONB -- file paths, metadata, source tracking
  data_gaps         JSONB -- what's missing and why

-- Report content (Markdown per section)
report_sections:
  id              UUID PK
  analysis_id     FK → analyses
  section_key     TEXT -- "tp_risks", "executive", "custom_defense_sector"
  title           TEXT -- "Ryzyka Transfer Pricing"
  summary_md      TEXT -- short version (2-3 sentences + key numbers)
  full_md         TEXT -- detailed version
  section_type    ENUM fixed/custom
  display_order   INT

-- Risks and opportunities (structured, queryable)
risks_and_opportunities:
  id              UUID PK
  analysis_id     FK → analyses
  type            ENUM risk/opportunity
  category        TEXT -- "tp", "vat", "ip_box", "cit", "custom", or any future domain
  name            TEXT
  description     TEXT
  level           ENUM CRITICAL/HIGH/MEDIUM/LOW
  amount_pln      BIGINT (nullable)
  reasoning_md    TEXT -- model explains its reasoning (visible in drill-down)

-- Scoring (overall + per category)
scoring:
  analysis_id     FK → analyses (PK)
  overall_score   INT (1-10)
  overall_level   ENUM HIGH/MEDIUM/LOW
  justification_md TEXT
  category_scores JSONB -- {"tp": 8, "tax": 5, "vat": 3, ...}

-- Users (simple for MVP)
users:
  id              UUID PK
  email           TEXT UNIQUE
  password_hash   TEXT
  name            TEXT
  created_at      TIMESTAMP
  is_active       BOOLEAN
```

### Key decisions
- **company vs analysis separated** — one company can have multiple analyses (yearly, re-runs). Full history preserved.
- **JSONB for extraction data** — schema evolves as new tax domains are added. No migration per field change. Fixed columns only where filtering/sorting is needed.
- **`report_sections` with `summary_md` + `full_md`** — both variants generated by model in Phase 4. Frontend toggles between them.
- **`section_type: custom`** — model can create company-specific sections beyond the fixed template.
- **`reasoning_md` in risks** — model explains its reasoning chain. Visible to analyst in drill-down. This is the "reasoning space."
- **`category` is open string** — not a closed enum. Supports future non-tax business analysis modules.
- **`user_id` nullable in MVP** — all users see all analyses initially. Per-user filtering added later without schema change.

---

## 5. Report Structure — Modular Design

```
REPORT: [Company Name]

── GENERAL ──────────────────────────────────────────
00. Executive Summary
    Key findings, top 3 risks, top 3 opportunities
    Overall score + scores per module

01. Company & Group Profile
    Financial data YoY, group structure, diagram

── THEMATIC MODULES ─────────────────────────────────
02. Transfer Pricing
    TP transactions, risks, scoring, recommendations

03. CIT / Corporate Income Tax
    ETR, reliefs, losses, risks, opportunities

04. IP Box / R&D
    Qualifying IP, relief potential, documentation requirements

05. VAT
    Transaction structure, IC supplies, risks

06. [Custom — model adds if relevant]
    E.g., SSE (Special Economic Zone), WHT, restructuring

── USER'S QUESTION (only if user provided custom prompt) ─
06b. Odpowiedź na Twoje pytanie
     Direct, targeted response to user's specific questions
     References relevant data from other sections

── SUMMARY ──────────────────────────────────────────
07. Risks & Opportunities — consolidated view
    Table: risk/opportunity, category, amount, level

08. Data Sources & Disclaimers
    Source tracking, OCR quality, data gaps
```

### Module structure (each thematic module 02-06 follows this pattern):
1. **Facts** — what the documents show
2. **Risks** — identified problems
3. **Opportunities** — potential optimizations/reliefs
4. **Recommendations** — next steps

### MVP scope
- Module 02 (Transfer Pricing): fully developed rules, prompts, golden standard
- Modules 03-05: model identifies signals from available data, marked as "preliminary assessment"
- Full rules per module built iteratively (separate research + design per topic)

### Toggle short/full operates at two levels:
- **Report level** — summary = section 00 + one sentence from each module; full = everything
- **Section level** — click a module to see summary, expand for details

---

## 6. Frontend

### Stack
- **React + Vite** — fast dev server, zero config
- **TailwindCSS** — utility-first, no custom stylesheets. Claude writes it well.
- **No heavy UI framework** — custom design, NOT "AI slop"

### Design philosophy
This must look and feel like a **professional product**, not a developer prototype.
Design research required before implementation: study best-in-class analytics dashboards
(Linear, Stripe Dashboard, Notion, Bloomberg Terminal) for patterns, information density,
and interaction design. The goal is a tool that PwC professionals would be proud to show
to clients. Separate frontend design session needed — visual companion + mockups.

### Views

**`/` — Dashboard**
- Topbar: logo, navigation, user
- Stats: X companies, Y HIGH+ risks, Z analyses running
- Input: "Wpisz nazwę spółki..." + [Analizuj] button
- Optional: "Na co szczególnie zwrócić uwagę?" expandable textarea
- Filters: risk level, date, status
- Company cards (score, key metrics, link to report)

**`/analyze/:id` — Live Progress**
- Company name + analysis metadata
- Progress bar (0-100%)
- Step-by-step checklist with timestamps:
  ✓ Pobrano dokumenty z e-KRS [12s]
  ✓ Wyodrębniono dane z XML [3s]
  ● Ekstrakcja danych (Claude AI)... [running]
  ○ Scoring ryzyk
  ○ Generowanie raportu
- Estimated time remaining

**`/report/:id` — Report View**
- Header: company name, KRS, date, overall score
- Toggle: [Skrót] [Pełny raport]
- Sidebar navigation (section list with scroll tracking)
- Main content area (Markdown → HTML rendering)
- Risks & opportunities cards with drill-down
- Export buttons: [PDF] [HTML]

**`/report/:id/export/pdf`** — server-side PDF generation (Puppeteer)
**`/report/:id/export/html`** — standalone HTML (like current reports)

### Authentication
- **MVP:** Email + password login, JWT tokens. Allowlisted emails.
- **Target:** Google / Apple OAuth (easy onboarding, no password management).
  Implementation: use a library like `authlib` (Python) + frontend OAuth flow.
  Prioritize Google first (most common in corporate environments).

### Per-user isolation (prepared, not active in MVP)
- `analyses.user_id` links to `users.id`
- MVP: no filter (all users see all)
- Later: `WHERE user_id = current_user` — zero schema changes

### Future: Teams & Sharing
- Team workspaces: group of users with shared access to a pool of analyses
- Report sharing: generate a shareable link (read-only, optionally time-limited)
- Data model supports this: add `teams` table, `team_id` FK on `analyses`,
  sharing = `shared_links` table with `analysis_id` + `token` + `expires_at`

### Future: Payment Gateway
- Per-analysis fee (Stripe Checkout or Stripe Payment Links)
- TBD: pricing model, free tier, subscription vs pay-per-use
- Architecture: payment verified before job starts, `analyses.payment_id` FK

---

## 7. Infrastructure & Deployment

```
┌─ Cloudflare Pages (free) ──────────┐
│  Frontend (React + Vite build)      │
│  Auto-deploy from git push          │
└──────────────┬──────────────────────┘
               │ API calls
               ▼
┌─ Railway.app ($5-20/month) ────────┐
│  ┌─ Web service ──────────────┐    │
│  │  FastAPI                    │    │
│  │  API endpoints + SSE + Auth │    │
│  └────────────────────────────┘    │
│  ┌─ Worker service ───────────┐    │
│  │  Pipeline runner            │    │
│  │  Playwright + pdfplumber    │    │
│  │  + Tesseract + Claude API   │    │
│  └────────────────────────────┘    │
│  ┌─ PostgreSQL ───────────────┐    │
│  │  All application data       │    │
│  └────────────────────────────┘    │
│  ┌─ Redis (later, if needed) ─┐    │
│  │  Job queue at scale         │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
               │
               ▼
        Claude API (Anthropic)
```

### Why Railway
- vs Vercel/Netlify — those can't run long-running processes (10-60s timeout)
- vs AWS/GCP — require VPC, IAM, security groups configuration
- vs Render — comparable, but Railway has better DX (dashboard, logs, metrics) and native Redis
- vs VPS (Hetzner/DO) — cheaper, but self-managed Docker, nginx, SSL, backups

### Cost estimate

**MVP (low traffic, ~30 analyses/month):**
| Component | Cost |
|-----------|------|
| Cloudflare Pages | $0 |
| Railway — web service | ~$5 |
| Railway — worker | ~$5-10 |
| Railway — PostgreSQL | ~$5 |
| Domain | ~$1 |
| Claude API (30 analyses) | ~$25-30 |
| **Total** | **~$40-50/month** |

**Scaled (500 users, ~200 analyses/month):**
| Component | Cost |
|-----------|------|
| Railway (scaled) | ~$50-80 |
| Claude API | ~$170-200 |
| **Total** | **~$250-300/month** |

---

## 8. Backlog — Future Features

These do NOT change the architecture but are recorded for planning:

### B1: AI Chat with Reports
- Endpoint `/chat` loads company data + report sections into Claude context
- Conversational interface for follow-up questions about any analyzed company
- Architecture supports this natively (data in PostgreSQL + Markdown sections)

### B2: Non-Tax Business Analysis
- `risks_and_opportunities.category` is an open string — supports "pricing_power", "working_capital", "market_position", etc.
- Report modules are plugins — new modules added without structural changes
- Requires: domain research per topic → prompt design → golden standard

### B3: Public Company Data (GPW/ESPI)
- Phase 1 scraping gets an additional adapter: "GPW/ESPI" alongside "e-KRS"
- Periodic reports (quarterly, annual) and current reports (8-K equivalent)
- Phases 2-4 unchanged — they receive the same data format regardless of source

### B4: Multi-Jurisdiction Support
- Phase 1: swappable data source adapters per country
  - Poland: e-KRS
  - UK: Companies House
  - Germany: Handelsregister / Bundesanzeiger
  - etc.
- Phases 2-4: same pipeline, prompts adapted for local tax rules
- Report modules: local tax topics per jurisdiction

### B5: Commercialization
- Payment gateway (Stripe)
- Public self-service access
- User accounts with subscription tiers
- Requires: legal review, terms of service, GDPR compliance

---

## 8b. Legal Disclaimer (required in all reports)

Every generated report MUST include the following disclaimer in section 08 (Data Sources & Disclaimers):

> Niniejszy raport ma charakter wyłącznie informacyjny i nie stanowi doradztwa podatkowego
> w rozumieniu ustawy z dnia 5 lipca 1996 r. o doradztwie podatkowym. Raport został
> wygenerowany automatycznie z wykorzystaniem sztucznej inteligencji na podstawie publicznie
> dostępnych danych. Przed podjęciem decyzji biznesowych lub podatkowych należy skonsultować
> się z licencjonowanym doradcą podatkowym.
>
> Analiza nie zastępuje dokumentacji cen transferowych ani benchmarkingu. AI nie przeprowadza
> analizy porównywalności — nie ma dostępu do komercyjnych baz danych. Scoring ryzyka jest
> orientacyjny i nie stanowi opinii podatkowej.

This text is non-negotiable and must appear in every report regardless of completeness level.

---

## 9. Implementation Approach

### Plan sequence (revised after design review)

1. **Plan 1** ✅ Foundation — backend scaffolding, auth, CRUD, frontend shell, tests
2. **Plan 2** UI Lite — dashboard with mock data (from v1 analyses), report view with hardcoded data. Gives visual product early.
3. **Plan 3** Extraction + Scoring — Claude API prompts for Phase 2 + Phase 3. Quality gates, scoring calibration on known companies.
4. **Plan 4** Report Generation — Phase 4 (writer + reviewer). Connect to UI.
5. **Plan 5** Scraping — Phase 1 (Playwright + pdfplumber + OCR). PDF upload fallback.
6. **Plan 6** Full UI + Deployment — complete frontend, Railway + Cloudflare Pages.

### Design per phase
Each pipeline phase will be designed in detail in a separate session:
1. **Research** the domain (e.g., TP methodology, CIT rules)
2. **Design** the prompt: persona, instructions, tools, quality gates
3. **Build golden standard** — expected output for known test companies (calibration)
4. **Implement** the code
5. **Evaluate** on real companies, iterate

### Scoring calibration
Score calibration uses 10-20 companies with known risk profiles (companies the team has worked with).
Compare AI output vs expert expectation, tune prompts and thresholds until alignment is satisfactory.

### Deterministic rules in prompts, not code
Materiality thresholds (art. 11k CIT: PLN 10M goods/services, PLN 10M financial, PLN 2.5M tax havens),
safe harbour rules (LVAS cost+5%), and cross-validation checks are included in Claude API prompts
for Phases 2-3, not hardcoded as business logic. A strong reasoning model handles these reliably.

---

## 10. Out of Scope for This Spec

- Detailed prompt design per phase (separate sessions)
- Golden standard reports (created during implementation)
- Specific extraction template field lists (refined per phase)
- Frontend visual design (separate design session)
- CI/CD pipeline details
- Monitoring and alerting setup
