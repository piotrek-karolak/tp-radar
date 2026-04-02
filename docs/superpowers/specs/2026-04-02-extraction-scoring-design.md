# TP Radar v2 — Extraction + Scoring Pipeline Design

> **Plan 3 spec** — Phase 2 (Extraction) and Phase 3 (Scoring) of the AI analysis pipeline.
> Depends on: Plan 1 (Foundation) ✅, Plan 2 (UI Lite) ✅
> Feeds into: Plan 4 (Report Generation), Plan 5 (Scraping)

---

## 1. Goal

Build the AI-powered core of TP Radar: a pipeline that takes uploaded financial documents (PDF/XML), extracts structured data via Claude API with tool use, then scores transfer pricing risk. Calibrate against 3 v1 companies (WB Electronics, Orange Polska, HAVI Service Hub) to validate prompt quality before connecting the scraper or report writer.

**Success criteria:**
- Upload PDF/XML → pipeline runs → `extracted_data`, `scoring`, `risks_and_opportunities` populated in DB
- Calibration: extracted data matches v1 JSON within ±5% on amounts, ±1 point on scores
- Pipeline status visible via existing SSE endpoint (`/analyses/{id}/stream`)
- Cost per analysis: ~$0.80 (Phase 2 + Phase 3 only, no report gen)

---

## 2. Architecture Overview

```
Upload PDF/XML ──→ Document Parser ──→ Phase 2: Extraction ──→ Phase 3: Scoring
     │                   │                    │                      │
  FastAPI          pdfplumber /          Claude API              Claude API
  multipart        BeautifulSoup      Sonnet 4.6 + tools      Sonnet 4.6 + tools
     │                   │                    │                      │
  local fs          ParsedDocument       ExtractedData            Scoring +
  storage          (text + struct)         (JSONB)            RisksAndOpps
```

**Flow:**
1. User uploads files via `POST /analyses/{id}/documents`
2. Document Parser (deterministic): XML→structured data, PDF→text, scanned PDF→OCR
3. Phase 2 (Claude API): full text + structured data → tool calls → `extracted_data`
4. Quality gate: check completeness, retry once if >30% fields missing
5. Phase 3 (Claude API): extracted data → tool calls → `scoring` + `risks_and_opportunities`
6. Pipeline orchestrated as background task, progress tracked in `analyses` table

---

## 3. Upload & Document Storage

### 3.1 Endpoint

```
POST /analyses/{analysis_id}/documents
Content-Type: multipart/form-data

Body: files[] (multiple)
```

**Validation:**
- Max file size: 20 MB per file
- Allowed types: `.pdf`, `.xml`, `.xhtml`
- Max files per analysis: 10
- Analysis must exist and belong to current user
- Analysis status must be PENDING (not already running)

**Response:** `201 Created` with list of uploaded document metadata.

### 3.2 Storage

Local filesystem: `data/uploads/{analysis_id}/{filename}`

Metadata stored in `extracted_data.raw_documents` (JSONB):
```json
[
  {
    "filename": "sprawozdanie.xml",
    "path": "data/uploads/{id}/sprawozdanie.xml",
    "size_bytes": 895000,
    "mime_type": "application/xml",
    "uploaded_at": "2026-04-02T10:00:00Z",
    "doc_type": "financial_statement",
    "parse_status": "parsed"
  }
]
```

### 3.3 Auto-trigger

After upload completes, pipeline starts automatically:
- Sets `analysis.status = RUNNING`, `current_phase = EXTRACTING`
- Launches `run_pipeline()` as background task

---

## 4. Document Parser

**Location:** `app/services/document_parser.py`

### 4.1 Input/Output

```python
@dataclass
class ParsedDocument:
    filename: str
    doc_type: str           # "financial_statement" | "supplementary_info" | "management_report"
    full_text: str          # always present — raw text for Claude
    structured_data: dict | None  # present only for XML/XHTML (iXBRL)
    tables: list[dict] | None    # present only for PDF with tables
    parse_method: str       # "ixbrl" | "pdfplumber" | "ocr"
    quality_score: float    # 0.0-1.0 — OCR confidence or parse completeness
```

### 4.2 Parsing strategies

**XML/XHTML (sprawozdanie finansowe):**
- BeautifulSoup with `lxml` parser
- Extract iXBRL tagged values (revenue, profit, assets, etc.)
- Also extract full text for Phase 2 deep reading
- Map iXBRL tags to extraction template fields where possible

**PDF (text-based — informacja dodatkowa, sprawozdanie zarządu):**
- pdfplumber: extract text page by page
- pdfplumber: extract tables separately (returns list of dicts)
- Concatenate into full_text with page markers

**PDF (scanned — auto-detect):**
- If <50 characters per page average → classified as scan
- OCR via Tesseract (`pytesseract`)
- quality_score reflects OCR confidence

### 4.3 Document classification

Heuristic based on filename + content:
- Contains `sprawozdanie` or iXBRL namespace → `financial_statement`
- Contains `informacja dodatkowa` or `objaśnieni` → `supplementary_info`
- Contains `sprawozdanie zarządu` or `działalności` → `management_report`
- Fallback: classify by content keywords

---

## 5. Phase 2 — Extraction (Claude API with Tool Use)

### 5.1 API Configuration

- **Model:** `claude-sonnet-4-6`
- **Max tokens:** 8192 (output)
- **Temperature:** 0 (deterministic extraction)
- **System prompt:** Financial analyst persona (see §5.2)
- **Tools:** 8 tools (see §5.3)

### 5.2 System Prompt

```
You are a senior financial analyst specializing in Polish corporate finance 
and transfer pricing. You analyze financial statements (sprawozdania finansowe), 
supplementary notes (informacja dodatkowa), and management reports 
(sprawozdanie z działalności zarządu) of Polish companies.

Your task: Extract ALL relevant financial data from the provided documents 
using the available tools. Be thorough — the quality of downstream risk 
analysis depends entirely on extraction completeness.

IMPORTANT RULES:
- All monetary amounts in PLN (integers, not thousands/millions)
- Use null for genuinely unavailable data — never guess or interpolate
- Call flag_data_gap() for any expected field you cannot find
- Call add_insight() for observations that don't fit the template fields
- Extract data for BOTH current and prior year when available
- Pay special attention to: related party transactions, cash pooling, 
  guarantees, loans, brand/IP licenses, management fees

DOCUMENT CONTEXT:
- XML/XHTML data below is the structured backbone (iXBRL-extracted numbers)
- Full document text follows — read it carefully for nuances, notes, 
  and information not captured by iXBRL tags
- Cross-reference numbers between sources when possible
```

### 5.3 Tools

**Core extraction tools:**

```json
{
  "name": "save_financials",
  "description": "Save current year financial data",
  "input_schema": {
    "type": "object",
    "properties": {
      "year": {"type": "integer"},
      "revenue": {"type": "integer", "description": "PLN"},
      "operating_profit": {"type": "integer", "description": "PLN"},
      "ebit_margin": {"type": "number", "description": "percentage, e.g. 21.7"},
      "net_profit": {"type": "integer", "description": "PLN"},
      "total_assets": {"type": ["integer", "null"], "description": "PLN"},
      "equity": {"type": ["integer", "null"], "description": "PLN"},
      "ebitda": {"type": ["integer", "null"], "description": "PLN"},
      "depreciation": {"type": ["integer", "null"], "description": "PLN"}
    },
    "required": ["year", "revenue", "operating_profit", "ebit_margin", "net_profit"]
  }
}
```

```json
{
  "name": "save_financials_prev",
  "description": "Save prior year financial data for YoY comparison",
  "input_schema": {
    "same structure as save_financials"
  }
}
```

```json
{
  "name": "save_cost_structure",
  "description": "Save operating cost breakdown",
  "input_schema": {
    "type": "object",
    "properties": {
      "year": {"type": "integer"},
      "personnel_costs": {"type": ["integer", "null"]},
      "depreciation": {"type": ["integer", "null"]},
      "external_services": {"type": ["integer", "null"]},
      "materials_and_goods": {"type": ["integer", "null"]},
      "other_operating_costs": {"type": ["integer", "null"]}
    },
    "required": ["year"]
  }
}
```

```json
{
  "name": "save_tp_transactions",
  "description": "Save all related party transactions identified in documents",
  "input_schema": {
    "type": "object",
    "properties": {
      "transactions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entity": {"type": "string", "description": "Related party name"},
            "amount_pln": {"type": "integer"},
            "type": {"type": "string", "enum": ["goods", "services", "financial", "royalty", "management_fee", "cash_pooling", "guarantee", "loan", "dividend", "lease", "other"]},
            "direction": {"type": "string", "enum": ["inbound", "outbound"]},
            "jurisdiction": {"type": ["string", "null"], "description": "ISO country code"},
            "terms": {"type": ["string", "null"], "description": "Key terms if disclosed"},
            "notes": {"type": ["string", "null"]}
          },
          "required": ["entity", "amount_pln", "type", "direction"]
        }
      }
    },
    "required": ["transactions"]
  }
}
```

```json
{
  "name": "save_tax_profile",
  "description": "Save tax-related data",
  "input_schema": {
    "type": "object",
    "properties": {
      "tax_expense": {"type": ["integer", "null"]},
      "profit_before_tax": {"type": ["integer", "null"]},
      "etr": {"type": ["number", "null"], "description": "Effective tax rate as percentage"},
      "deferred_tax_asset": {"type": ["integer", "null"]},
      "deferred_tax_liability": {"type": ["integer", "null"]},
      "tax_notes": {"type": ["string", "null"]},
      "tax_risk_level": {"type": ["string", "null"], "enum": ["LOW", "MEDIUM", "HIGH", null]}
    }
  }
}
```

```json
{
  "name": "save_mgmt_report",
  "description": "Save management report analysis",
  "input_schema": {
    "type": "object",
    "properties": {
      "tp_policy_mentioned": {"type": "boolean"},
      "apa_mentioned": {"type": "boolean"},
      "group_structure_changes": {"type": ["string", "null"]},
      "strategy_highlights": {"type": ["string", "null"]},
      "commentary": {"type": ["string", "null"]},
      "risk_flags": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

**Meta tools:**

```json
{
  "name": "flag_data_gap",
  "description": "Flag a field that should exist but could not be found in documents",
  "input_schema": {
    "type": "object",
    "properties": {
      "field": {"type": "string", "description": "Which field is missing, e.g. 'total_assets'"},
      "reason": {"type": "string", "description": "Why it's missing, e.g. 'Not disclosed in simplified financial statement'"}
    },
    "required": ["field", "reason"]
  }
}
```

```json
{
  "name": "add_insight",
  "description": "Record an observation that doesn't fit standard template fields. Use for cross-document connections, anomalies, or company-specific patterns.",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": {"type": "string", "description": "e.g. 'tp', 'tax', 'structure', 'anomaly'"},
      "observation": {"type": "string"},
      "evidence": {"type": ["string", "null"], "description": "Quote or reference from document"}
    },
    "required": ["category", "observation"]
  }
}
```

### 5.4 Tool Call Processing

Each tool call is processed by `ExtractionToolHandler`:
1. Validate input against schema
2. Merge into `extracted_data` JSONB fields (upsert)
3. Return confirmation: `{"status": "saved", "field": "financials"}`

The handler accumulates all tool calls and writes to DB once after the full API response.

### 5.5 Quality Gate

After extraction completes, check completeness:

```python
REQUIRED_FIELDS = {
    "financials": ["revenue", "operating_profit", "net_profit"],
    "tp_transactions": [],  # at least 1 transaction expected
    "tax_profile": ["tax_expense", "profit_before_tax"],
}

OPTIONAL_BLOCKS = ["mgmt_report", "cost_structure"]
```

**Rules:**
- If >30% of required fields are null AND no `flag_data_gap` explains why → retry
- Retry prompt: "The following fields are missing: {list}. Please review the documents again and extract these specifically. If genuinely unavailable, call flag_data_gap()."
- Max 1 retry
- After retry (or if quality gate passes): proceed to Phase 3

---

## 6. Phase 3 — Scoring (Claude API with Tool Use)

### 6.1 API Configuration

- **Model:** `claude-sonnet-4-6`
- **Max tokens:** 4096 (output)
- **Temperature:** 0
- **System prompt:** Tax advisor persona (see §6.2)
- **Tools:** 4 tools (see §6.3)

### 6.2 System Prompt

```
You are a senior tax advisor specializing in transfer pricing (ceny transferowe) 
for Polish companies. You assess TP risk based on extracted financial data.

Your task: Identify ALL transfer pricing risks and opportunities, score each 
category, and provide an overall risk assessment.

DETERMINISTIC RULES (always apply):
1. Materiality thresholds (art. 11k CIT Act):
   - Goods/services: PLN 10,000,000 → must be documented
   - Financial transactions: PLN 10,000,000 → must be documented
   - Tax haven transactions: PLN 2,500,000 → must be documented
2. Safe harbour LVAS: cost + 5% markup for low-value-added services
3. 100% revenue from related parties → minimum MEDIUM risk
4. Implied interest rate >50% or <0% → flag as anomaly, do not score
5. Uncompensated guarantees → minimum HIGH risk if amount >10M PLN
6. Cash pooling without disclosed terms → minimum HIGH risk

SCORING FRAMEWORK:
- Per category (tp, cit, vat, ip_box, custom): 1-10
- Overall: weighted by materiality and severity
- Base formula: CRITICAL×3 + HIGH×2 + MEDIUM×1 → scale to 1-10
  - ≤2 → LOW, 3-5 → MEDIUM, 6-8 → HIGH, 9-10 → CRITICAL
- You MAY override the formula with justification (e.g., single massive risk)

IMPORTANT:
- Each risk/opportunity must include reasoning_md explaining your analysis
- Quantify amount_pln where possible (null if not quantifiable)
- Category is open string — use "tp", "cit", "vat", "ip_box", or create custom
- Look for opportunities too — IP Box potential, APA candidates, structure optimization
```

### 6.3 Tools

```json
{
  "name": "add_risk",
  "description": "Record a transfer pricing or tax risk",
  "input_schema": {
    "type": "object",
    "properties": {
      "name": {"type": "string", "description": "Descriptive title in Polish"},
      "category": {"type": "string", "description": "tp, cit, vat, ip_box, or custom"},
      "level": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
      "amount_pln": {"type": ["integer", "null"], "description": "Financial exposure in PLN"},
      "description": {"type": "string", "description": "Brief description in Polish"},
      "reasoning_md": {"type": "string", "description": "Detailed reasoning in Markdown (Polish)"}
    },
    "required": ["name", "category", "level", "description", "reasoning_md"]
  }
}
```

```json
{
  "name": "add_opportunity",
  "description": "Record a tax optimization opportunity",
  "input_schema": {
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "category": {"type": "string"},
      "level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
      "description": {"type": "string"},
      "reasoning_md": {"type": "string"}
    },
    "required": ["name", "category", "description", "reasoning_md"]
  }
}
```

```json
{
  "name": "set_category_score",
  "description": "Set risk score for a specific category",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": {"type": "string"},
      "score": {"type": "integer", "minimum": 1, "maximum": 10},
      "justification": {"type": "string"}
    },
    "required": ["category", "score", "justification"]
  }
}
```

```json
{
  "name": "set_overall_score",
  "description": "Set the overall risk score and level",
  "input_schema": {
    "type": "object",
    "properties": {
      "score": {"type": "integer", "minimum": 1, "maximum": 10},
      "level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
      "justification_md": {"type": "string", "description": "Overall assessment in Markdown (Polish)"}
    },
    "required": ["score", "level", "justification_md"]
  }
}
```

### 6.4 Input Construction

Phase 3 receives the full `extracted_data` as structured JSON in the user message:

```
Here is the extracted financial data for {company_name} ({krs}), 
financial year {year}:

## Financials
{json of extracted_data.financials}

## Prior Year
{json of extracted_data.financials_prev}

## Cost Structure
{json of extracted_data.cost_structure}

## Related Party Transactions
{json of extracted_data.tp_transactions}

## Tax Profile
{json of extracted_data.tax_profile}

## Management Report
{json of extracted_data.mgmt_report}

## Analyst Insights (from extraction phase)
{json of extracted_data.insights}

## Data Gaps
{json of extracted_data.data_gaps}
```

---

## 7. Pipeline Orchestration

### 7.1 Service

**Location:** `app/services/pipeline.py`

```python
async def run_pipeline(analysis_id: UUID, db: AsyncSession) -> None:
    """Run extraction + scoring pipeline as background task."""
    try:
        # Phase 2: Extraction
        await update_progress(analysis_id, db, 
            phase=AnalysisPhase.EXTRACTING, pct=10, 
            message="Parsowanie dokumentów...")
        
        documents = await parse_documents(analysis_id)
        
        await update_progress(analysis_id, db, pct=20, 
            message="Ekstrakcja danych przez AI...")
        
        extracted = await run_extraction(analysis_id, documents, db)
        
        # Quality gate
        gaps = check_completeness(extracted)
        if gaps.needs_retry:
            await update_progress(pct=35, 
                message="Uzupełnianie brakujących danych...")
            extracted = await retry_extraction(analysis_id, documents, gaps, db)
        
        await update_progress(pct=50, 
            message="Ekstrakcja zakończona. Scoring...")

        # Phase 3: Scoring
        await update_progress(phase=AnalysisPhase.SCORING, pct=60,
            message="Ocena ryzyka TP...")
        
        await run_scoring(analysis_id, extracted, db)
        
        await update_progress(pct=80, 
            message="Scoring zakończony.",
            status=AnalysisStatus.DONE)
        
    except Exception as e:
        await update_progress(
            status=AnalysisStatus.FAILED, 
            error_message=str(e))
        raise
```

### 7.2 Claude API Client

**Location:** `app/services/claude_client.py`

Thin wrapper around Anthropic SDK:
- Handles tool use loop (send → get tool calls → process → respond → repeat until stop)
- Tracks token usage for `cost_usd` calculation
- Pricing: Sonnet 4.6 input $3/1M tokens, output $15/1M tokens

### 7.3 Background Task Execution

Upload endpoint triggers pipeline:
```python
@router.post("/analyses/{analysis_id}/documents", status_code=201)
async def upload_documents(analysis_id: UUID, files: list[UploadFile], ...):
    # Save files, update raw_documents metadata
    # Launch pipeline
    asyncio.create_task(run_pipeline(analysis_id, db))
    return {"documents": [...], "message": "Pipeline started"}
```

---

## 8. Calculated Fields

After Phase 2 extraction, the pipeline computes derived metrics (deterministic, not AI):

```python
# Financial ratios
equity_ratio = equity / total_assets  if both present else null
debt_ebitda = financial_debt / ebitda  if ebitda > 0 else null
icr = ebitda / interest_costs_rp  if interest_costs > 0 else null
implied_rate = (interest_costs_rp / avg_debt_rp) * 100  # null if >50% or <0%

# Tax metrics
etr = tax_expense / profit_before_tax  # null if PBT ≤ 0 or result <0% or >40%
etr_deviation_pp = etr - 19.0

# YoY deltas (current vs prev)
revenue_pct = (revenue - revenue_prev) / revenue_prev * 100
ebit_margin_pp = ebit_margin - ebit_margin_prev
# ... etc for all tracked metrics
```

Stored in `extracted_data.financials` as additional computed fields.

---

## 9. Calibration

### 9.1 Test Fixtures

Copy v1 documents to `backend/tests/fixtures/`:

```
tests/fixtures/
├── havi-service-hub/
│   ├── sprawozdanie.xml          (895K — from .playwright-mcp/)
│   ├── sprawozdanie-zarzadu.pdf  (769K)
│   └── informacja-dodatkowa.pdf  (635K)
├── wb-electronics/
│   └── informacja-dodatkowa.pdf  (299K)
├── orange-polska/
│   └── sprawozdanie.xhtml        (3.98MB — from Dokumenty.zip)
└── v1-reference/
    └── companies.json             (copy of v1 data for comparison)
```

### 9.2 Calibration Script

**Location:** `scripts/calibrate.py`

```
Usage: python -m scripts.calibrate [--company SLUG] [--verbose]

For each company:
1. Upload test fixtures to running backend
2. Wait for pipeline completion
3. Fetch extracted_data + scoring from API
4. Compare with v1 reference data
5. Report:
   - Field-by-field match (exact, within ±5%, mismatch, missing)
   - Score comparison (v1 vs v2, delta)
   - Risk comparison (matched risks, new risks, missing risks)
```

### 9.3 Acceptance Criteria

| Metric | Threshold |
|--------|-----------|
| Financial amounts | ±5% of v1 values |
| Overall score | ±1 point of v1 |
| Risk identification | All v1 CRITICAL/HIGH risks found |
| New risks | Acceptable (model may find more) |
| Missing MEDIUM risks | ≤2 per company |
| Pipeline runtime | <60 seconds per company |
| Cost per analysis | <$1.00 (Phase 2+3 only) |

---

## 10. Dependencies & Infrastructure

### 10.1 New Python Packages

```
anthropic          # Claude API SDK
pdfplumber         # PDF text/table extraction
beautifulsoup4     # XML/XHTML parsing
lxml               # Fast XML parser backend
pytesseract        # OCR (optional — for scanned PDFs)
python-multipart   # FastAPI file uploads
```

### 10.2 Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...    # Required for Claude API
UPLOAD_DIR=data/uploads          # Document storage path
MAX_UPLOAD_SIZE_MB=20            # Per-file upload limit
```

### 10.3 File Structure (new/modified)

```
backend/
├── app/
│   ├── routers/
│   │   └── documents.py          # NEW — upload endpoint
│   ├── services/
│   │   ├── document_parser.py    # NEW — PDF/XML parsing
│   │   ├── claude_client.py      # NEW — Claude API wrapper
│   │   ├── extraction.py         # NEW — Phase 2 logic + tools
│   │   ├── scoring.py            # NEW — Phase 3 logic + tools
│   │   └── pipeline.py           # NEW — orchestration
│   ├── schemas/
│   │   └── documents.py          # NEW — upload schemas
│   └── main.py                   # MODIFY — register documents router
├── scripts/
│   └── calibrate.py              # NEW — calibration script
├── tests/
│   ├── fixtures/                 # NEW — v1 documents
│   ├── test_document_parser.py   # NEW
│   ├── test_extraction.py        # NEW
│   ├── test_scoring.py           # NEW
│   ├── test_pipeline.py          # NEW
│   └── test_upload.py            # NEW
└── data/
    └── uploads/                  # NEW — runtime document storage
```

---

## 11. Spec Update: Phase 1 Data Acquisition (for Plan 5)

Based on API research (2026-04-02), the data acquisition strategy for Plan 5 is updated:

**Primary: rejestr.io API** (not Playwright)
- Endpoint: `https://rejestr.io/api/info/dokument-finansowy-organizacji`
- Cost: 0.50 PLN/query (~25 PLN/year for 50 companies)
- Returns: JSON structured data + PDF download links
- Advantage: Stable API vs brittle browser scraping

**Secondary: Official KRS Open API** (registry data only)
- Endpoint: `https://api-krs.ms.gov.pl/api/krs/{type}/{krs_number}`
- Cost: Free
- Returns: Company registration data (name, address, NIP, board members)
- Does NOT include financial statements

**Fallback: Playwright scraping e-KRS**
- URL: `https://ekrs.ms.gov.pl/rdf/pd/search_df`
- When: rejestr.io unavailable or insufficient
- Maintained but not primary path

**Manual upload** (built in Plan 3):
- Always available as fallback
- Required for documents not in e-KRS (internal analyses, custom documents)

---

## 12. Out of Scope

- Phase 4 (Report Generation) — Plan 4
- Phase 1 (Scraping/data acquisition) — Plan 5
- Frontend changes for upload UI — Plan 4 or 5
- User prompt injection — Plan 4 (report gen)
- Multi-user access control — later
- S3 storage migration — deployment phase
