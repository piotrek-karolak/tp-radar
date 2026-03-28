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

### Phase 1: Scraping + Parsing (deterministic, no AI)
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

1d. Online research (parallel with 1b-1c)
    - Company IR website
    - Parent/group profile
    - Press articles, stock exchange communications (if GPW-listed)
    - KRS online — board composition, connections, history

    Output: raw text with metadata (source, retrieval date)
```

### Phase 2: Extraction (Claude API, prompt 1)
Progress: 25% → 60%

```
System prompt: financial analyst persona
Input: parsed data from Phase 1 (XML structured + PDF text + online research)
Tools:
  - save_financials(year, revenue, ebit, ...)
  - save_tp_transactions(entity, amount, type, ...)
  - save_tax_profile(etr, deferred_tax, ...)
  - save_mgmt_report(strategy, risk_flags, ...)
  - save_group_structure(entities, relationships, ...)
  - flag_data_gap(field, reason)         ← quality gate
  - add_insight(category, observation, evidence) ← model's reasoning space
```

Key: `add_insight()` lets the model record observations beyond the template. These flow into Phases 3-4.

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

### Phase 4: Report Generation (Claude API, prompt 3)
Progress: 80% → 100%

```
System prompt: report writer persona with style guide
Input: complete data + scoring from Phases 2-3
Output: Markdown per section (React renders to HTML)

Tools:
  - write_section(key, title, summary_md, full_md)
  - write_custom_section(title, summary_md, full_md, after_key)
```

Model generates both SUMMARY and FULL variants of each section. Custom sections for company-specific topics.

Report style guide and golden standard to be developed during implementation.

### Why 4 phases, not one prompt
1. Phase 1 needs no AI — saves tokens ($)
2. Extraction (facts) separated from scoring (judgment) — like audit: gather evidence, then form opinion
3. Report writing is a different skill than data analysis — separate prompt = better style control
4. Cost control — if Phase 1 fails (e-KRS down), zero API spend

### Token cost estimate per analysis
| Phase | Input tokens | Output tokens | ~Cost |
|-------|-------------|---------------|-------|
| Phase 2 (extraction) | ~30k | ~5k | ~$0.40 |
| Phase 3 (scoring) | ~10k | ~3k | ~$0.15 |
| Phase 4 (report) | ~15k | ~8k | ~$0.30 |
| **Total** | | | **~$0.85** |

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
- **No heavy UI framework** — custom design, evolved from current tp-radar aesthetic

### Views

**`/` — Dashboard**
- Topbar: logo, navigation, user
- Stats: X companies, Y HIGH+ risks, Z analyses running
- Input: "Wpisz nazwę spółki..." + [Analizuj] button
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

### Authentication (MVP)
- Email + password login, JWT tokens
- Allowlisted emails in environment variable
- No OAuth/SSO in v1

### Per-user isolation (prepared, not active in MVP)
- `analyses.user_id` links to `users.id`
- MVP: no filter (all users see all)
- Later: `WHERE user_id = current_user` — zero schema changes

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

## 9. Implementation Approach

Each pipeline phase will be designed in detail in a separate session:
1. **Research** the domain (e.g., TP methodology, CIT rules)
2. **Design** the prompt: persona, instructions, tools, quality gates
3. **Build golden standard** — expected output for test companies
4. **Implement** the code
5. **Evaluate** on real companies, iterate

This ensures each phase is "thought through to atoms" before implementation, not built from a rough sketch.

---

## 10. Out of Scope for This Spec

- Detailed prompt design per phase (separate sessions)
- Golden standard reports (created during implementation)
- Specific extraction template field lists (refined per phase)
- Frontend visual design (separate design session)
- CI/CD pipeline details
- Monitoring and alerting setup
