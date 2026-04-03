# TP Radar v2 — Report Generation Design (Plan 4)

> **Status:** Approved  
> **Date:** 2026-04-03  
> **Repo:** `/Users/piotrkarolak/Claude Code/tp-radar-v2/`

---

## Goal

Build the report generation phase that transforms extracted data + scoring into a professional 11-section Markdown report. The pipeline uses a Writer → Validator → Reviewer → Reviser flow with three layers of risk identification.

## Architecture

```
Pipeline (pipeline.py) — existing flow extended:
  Extracting → Scoring → WRITING (new)

WRITING phase:
  1. Writer    (Claude Sonnet 4.6, tool use)
  2. Validator  (Python — deterministic checks)
  3. Reviewer   (Claude Opus 4.6, plain text)
  4. Reviser    (Claude Sonnet 4.6, tool use) — max 1 iteration, skipped if no feedback
  5. Persist    (DB write)
```

### Model assignments

| Role | Model | Tool use | Why |
|------|-------|----------|-----|
| Writer | Sonnet 4.6 | Yes — 2 tools | Fast, cheap, good at structured output |
| Reviewer | Opus 4.6 | No — plain text | Deep reasoning, expert-level insights |
| Reviser | Sonnet 4.6 | Yes — same as Writer | Applies targeted corrections |

## Writer

### Approach

Single Claude call. Writer receives all extracted data + scoring and produces:
- 11 report sections via `write_report_sections` tool
- Optional additional risks/opportunities via `flag_additional_risk` tool

### Tools

#### `write_report_sections`

```json
{
  "sections": {
    "executive":          { "summary_md": "str", "full_md": "str" },
    "financial_metrics":  { "summary_md": "str", "full_md": "str" },
    "overall_risk":       { "summary_md": "str", "full_md": "str" },
    "financial_ratios":   { "summary_md": "str", "full_md": "str" },
    "group_structure":    { "summary_md": "str", "full_md": "str" },
    "tp_transactions":    { "summary_md": "str", "full_md": "str" },
    "balances":           { "summary_md": "str", "full_md": "str" },
    "risk_assessment":    { "summary_md": "str", "full_md": "str" },
    "priority_matrix":    { "summary_md": "str", "full_md": "str" },
    "methodology":        { "summary_md": "str", "full_md": "str" },
    "management_context": { "summary_md": "str", "full_md": "str" }
  }
}
```

- `summary_md` — 1-3 sentences, for Summary tab in frontend
- `full_md` — full Markdown with tables, lists, details

#### `flag_additional_risk`

```json
{
  "name": "str",
  "category": "str (tp|cit|vat|ip_box|custom)",
  "level": "str (CRITICAL|HIGH|MEDIUM|LOW)",
  "type": "str (risk|opportunity)",
  "description": "str (2-3 sentences)",
  "amount_pln": "int|null",
  "reasoning_md": "str|null (detailed Markdown)"
}
```

Writer may call this tool multiple times. System prompt instructs: "If while writing you notice risks or opportunities not identified in scoring — flag them."

### Input

Single user message with full context:

```
Firma: {company.name} (KRS: {company.krs})
Rok: {analysis.financial_year}
=== DANE FINANSOWE ===
{json extracted_data.financials}
=== DANE FINANSOWE (ROK POPRZEDNI) ===
{json extracted_data.financials_prev}
=== STRUKTURA KOSZTOW ===
{json extracted_data.cost_structure}
=== TRANSAKCJE TP ===
{json extracted_data.tp_transactions}
=== PROFIL PODATKOWY ===
{json extracted_data.tax_profile}
=== SPRAWOZDANIE ZARZADU ===
{json extracted_data.mgmt_report}
=== INSIGHTS Z EKSTRAKCJI ===
{json extracted_data.insights}
=== SCORING ===
overall_score: {scoring.overall_score}
overall_level: {scoring.overall_level}
category_scores: {json scoring.category_scores}
risks: {json risks}
opportunities: {json opportunities}
=== BRAKI DANYCH ===
{json extracted_data.data_gaps}
```

### System prompt guidelines (refinement later)

- Language: Polish, professional advisory tone
- Amount formatting: >=1M → `73,5 mln PLN`, 100K-999K → `389 tys. PLN`
- Use Markdown tables for numeric data
- Missing data → explicit `⚠ Brak danych` annotation
- Reference specific transactions and amounts, avoid generic statements
- `risk_assessment` full_md must include actionable recommendations

## Validator

Deterministic Python checks between Writer output and source data.

### Checks

| # | Check | Type | Reaction |
|---|-------|------|----------|
| 1 | All 11 sections have non-empty `summary_md` and `full_md` | Error | List missing |
| 2 | Amounts in executive match `financials.revenue`, `net_profit` (±5%) | Warning | Flag discrepancy |
| 3 | Overall score in `overall_risk` matches `scoring.overall_score` | Error | Flag mismatch |
| 4 | Risk level consistency — `risk_assessment` doesn't say "low risk" when scoring = HIGH | Warning | Flag |
| 5 | Data gaps reflected — if `data_gaps` non-empty, report contains ⚠ annotations | Warning | List omitted gaps |
| 6 | Markdown syntax — tables have headers, no unclosed blocks | Warning | Flag |

### Output

```python
@dataclass
class ValidationResult:
    errors: list[str]      # blocking — Reviewer must see
    warnings: list[str]    # informational — Reviewer gets as context
    is_valid: bool         # True if 0 errors
```

Validator does NOT block the pipeline. Results are passed to Reviewer as additional context.

## Reviewer

### Role

Two responsibilities:
1. **QA** — find errors, inconsistencies, omissions in the report
2. **Enrichment** — add deeper insights and non-obvious risks that Writer missed

### Model

`ClaudeClient(model="claude-opus-4-6")` — no tool use, plain text response.

### Input

```
=== RAPORT (wygenerowany) ===
{11 sections as Markdown}

=== DANE ZRODLOWE ===
{extraction + scoring JSON — same as Writer received}

=== WYNIK WALIDACJI ===
Errors: {list}
Warnings: {list}

=== INSTRUKCJE ===
1. Verify report consistency with source data
2. Evaluate quality of recommendations in risk_assessment
3. Identify missing conclusions or overlooked risks
4. Return feedback in structured format below
```

### Output format (plain text, parsed by Python)

```markdown
## Poprawki
- [sekcja: executive] Description of correction needed
- [sekcja: risk_assessment] Description of correction needed

## Nowe insights (do wplecenia w narracje)
- Observation to weave into relevant section

## Nowe ryzyka
- name: "Risk name"
  category: tp
  level: MEDIUM
  type: risk
  amount_pln: null
  description: "2-3 sentences"
  reasoning_md: "Detailed markdown"

## Nowe szanse
- name: "Opportunity name"
  category: tp
  level: MEDIUM
  type: opportunity
  amount_pln: null
  description: "2-3 sentences"
  reasoning_md: "Detailed markdown"
```

### Parsing

Python parser extracts:
- `corrections: list[dict]` — section + description
- `new_insights: list[str]` — for Reviser to weave in
- `new_risks: list[dict]` — formal risks to add to DB
- `new_opportunities: list[dict]` — formal opportunities to add to DB

Parser must be resilient to formatting variations (extra whitespace, missing fields, different heading levels). Use regex-based section splitting, not strict YAML parsing. If a section is malformed, log warning and skip it — don't fail the pipeline.

## Reviser

Same Writer setup (Sonnet, tool use, same tools) with additional context:

### Input

```
=== ORYGINALNY RAPORT ===
{11 sections Markdown}

=== FEEDBACK REVIEWERA ===
{corrections + new_insights}

=== INSTRUKCJE ===
1. Apply each correction from "Poprawki"
2. Weave new insights into appropriate sections
3. Do not change sections not mentioned in feedback
4. Return full report via write_report_sections
```

### Skip logic

If Reviewer returns no corrections and no new insights → Reviser is NOT called. Saves one API call.

## Persist

### ReportSection rows

```python
SECTION_ORDER = {
    "executive": "Podsumowanie wykonawcze",
    "financial_metrics": "Dane finansowe",
    "overall_risk": "Ogolna ocena ryzyka TP",
    "financial_ratios": "Wskazniki finansowe i podatkowe",
    "group_structure": "Struktura grupy",
    "tp_transactions": "Transakcje z podmiotami powiazanymi",
    "balances": "Salda naleznosci i zobowiazan",
    "risk_assessment": "Szczegolowa ocena ryzyka",
    "priority_matrix": "Matryca priorytetow",
    "methodology": "Metodologia i scoring",
    "management_context": "Kontekst sprawozdania zarzadu",
}
```

11 `ReportSection` rows with `section_type=FIXED`, `display_order=1..11`.

### RiskAndOpportunity rows

Three sources persisted to DB:
1. **Scoring phase** — already saved by existing pipeline code
2. **Writer** — from `flag_additional_risk` tool calls
3. **Reviewer** — from parsed `Nowe ryzyka` / `Nowe szanse` sections

All stored as `RiskAndOpportunity` rows with identical schema.

## Pipeline integration

### Where in pipeline.py

After scoring persist (line ~251), before final status update:

```python
await _update_progress(analysis, db,
    phase=AnalysisPhase.WRITING, pct=80,
    message="Generowanie raportu...")

generator = ReportGenerator()
report_result = await generator.run(
    company=company,
    analysis=analysis,
    extracted_data=extracted_data,
    scoring=scoring_obj,
    existing_risks=scoring_state.risks + scoring_state.opportunities,
    db=db,
)

await _update_progress(analysis, db,
    status=AnalysisStatus.DONE, pct=100,
    message="Analiza zakonczona.",
    cost_usd=report_result.cost_usd)
```

### Progress tracking

| pct | Phase |
|-----|-------|
| 80 | Writing started |
| 85 | Validator done |
| 90 | Reviewer done |
| 95 | Reviser done |
| 100 | Persisted, DONE |

### `AnalysisPhase.WRITING`

Already exists in the enum — no schema change needed.

## Risk identification layers

| Layer | Model | Data access | What it catches |
|-------|-------|-------------|-----------------|
| 1. Scoring | Sonnet | Structured extraction data | Standard TP risks from financial data |
| 2. Writer | Sonnet | Same + scoring results | Contextual risks emerging while writing narrative |
| 3. Reviewer | Opus | Everything above + full report | Non-obvious, expert-level, cross-cutting risks |

Each layer sees progressively more context. Like a real advisory team: analyst → senior → partner.

## Files

### New

- `backend/app/services/report_generator.py` — ReportGenerator class (write, validate, review, revise, persist)
- `backend/tests/test_report_generator.py` — tests with mocked Claude API

### Modified

- `backend/app/services/pipeline.py` — add WRITING phase after scoring
- `backend/app/services/claude_client.py` — add `run_simple()` method for Reviewer (no tool use, returns text)

## Data gaps handling

When `extracted_data.data_gaps` is non-empty:
- Writer adds `⚠ Brak danych` annotations in relevant sections
- Validator checks that gaps are reflected in report
- Reviewer verifies gap handling is appropriate

## Iteration policy

- Max 1 revision iteration (Writer → Validator → Reviewer → Reviser)
- No second review pass
- If Reviewer has no feedback → skip Reviser entirely

## Cost estimate

Per analysis (approximate):
- Writer (Sonnet): ~4k input + ~4k output ≈ $0.07
- Reviewer (Opus): ~8k input + ~2k output ≈ $0.07 (Opus pricing)
- Reviser (Sonnet): ~6k input + ~4k output ≈ $0.08 (if needed)
- Total WRITING phase: ~$0.15-0.22
- Total pipeline (extraction + scoring + writing): ~$0.40-0.60
