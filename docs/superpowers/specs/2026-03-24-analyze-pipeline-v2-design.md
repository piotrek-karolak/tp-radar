# TP Radar — Analyze Pipeline v2: Design Spec

**Date:** 2026-03-24
**Status:** Draft
**Scope:** Redesign of `/analyze` skill and `companies.json` schema to support r/r analysis, management report extraction, and tax profile assessment.

---

## 1. Goal

Build the best possible TP analysis process — not backward-compatible with the 3 existing test reports. The pipeline should be data-first: skill fills a structured extraction template → data goes into `companies.json` → HTML report renders entirely from JSON, zero improvisation.

---

## 2. Architecture

```
Step 0:  TP methodology research (public sources: OECD, MF, KAS)
Step 1:  Company ID slug
Step 2:  KRS lookup
Step 3:  Document download (xml/xhtml + informacja_dodatkowa.pdf + sprawozdanie_zarzadu.pdf)
Step 4:  EXTRACTION TEMPLATE — 6 blocks (gate: must be complete before Step 5)
Step 5:  TP risk scoring (unchanged)
Step 6:  Calculate ratios + r/r deltas
Step 7:  Text style rules (unchanged)
Step 8:  Generate HTML report (11 sections, numbered 00–10)
Step 9:  HTML validation (extended)
Step 10: Update companies.json (extended schema)
Step 11: Deploy (unchanged)
```

**Note on numbering:** "Steps" (0–11) refer to pipeline phases; "Sections" (00–10) refer to HTML report sections. These are independent numbering systems.

**Source of truth:** `companies.json`. The HTML report must be derivable entirely from the JSON entry. No data should appear in the HTML that is not present in JSON.

---

## 3. Step 0 — TP Methodology Research

Before writing the extraction template and scoring rubric, conduct research on:

1. **R/R indicators relevant to TP risk** — which financial dynamics signal TP manipulation per OECD TP Guidelines (Chapter I–III), Polish MF rozporządzenie z 2021 r., and KAS audit practice
2. **Management report TP signals** — what disclosures/phrases in sprawozdanie zarządu indicate TP risk (group restructuring, new intercompany agreements, APA, business restructuring under OECD Chapter IX)
3. **Tax profile TP relevance** — ETR thresholds and anomalies that indicate aggressive tax planning; Pillar Two 15% minimum rate implications; deferred tax red flags
4. **Cost structure TP signals** — which cost ratios (personnel/revenue, external services/revenue) are TP-relevant for SSC/captive service providers

**Output:** A research summary saved to `docs/superpowers/specs/2026-03-24-tp-methodology-research.md`. Format: one section per research topic, each with specific thresholds/rules derived from sources. User reviews and approves before implementation proceeds to Step 2+.

**Sources:** OECD TP Guidelines 2022, MF rozporządzenie ws. dokumentacji (Dz.U. 2021), KAS materials, EU ATAD/DAC6, public PwC/Deloitte TP guidance.

---

## 4. Extended JSON Schema

New fields added to each company entry in `companies.json`:

```json
{
  "financials": {
    "year": null,
    "revenue": null,
    "operating_profit": null,
    "ebit_margin": null,
    "net_profit": null,
    "total_assets": null,
    "equity": null,
    "ebitda": null,
    "equity_ratio": null,
    "debt_ebitda": null,
    "icr": null,
    "implied_rate": null,
    "cost_structure": {
      "personnel_costs": null,
      "depreciation": null,
      "external_services": null,
      "materials_and_goods": null,
      "other_operating_costs": null
    }
  },

  "financials_prev": {
    "year": null,
    "revenue": null,
    "operating_profit": null,
    "ebit_margin": null,
    "net_profit": null,
    "total_assets": null,
    "equity": null,
    "ebitda": null,
    "equity_ratio": null,
    "debt_ebitda": null,
    "cost_structure": {
      "personnel_costs": null,
      "depreciation": null,
      "external_services": null,
      "materials_and_goods": null,
      "other_operating_costs": null
    }
  },

  "yoy_deltas": {
    "revenue_pct": null,
    "ebit_margin_pp": null,
    "net_profit_pct": null,
    "ebitda_pct": null,
    "tp_purchases_pct": null,
    "tp_sales_pct": null,
    "personnel_costs_pct": null,
    "external_services_pct": null
  },

  "tax": {
    "tax_expense": null,
    "profit_before_tax": null,
    "etr": null,
    "statutory_rate": 19.0,
    "etr_deviation_pp": null,
    "deferred_tax_asset": null,
    "deferred_tax_liability": null,
    "deferred_tax_net": null,
    "tax_notes": null,
    "tax_risk_level": null    // enum: "LOW" | "MEDIUM" | "HIGH" | null
  },

  "mgmt_report": {
    "read": false,
    "tp_policy_mentioned": false,
    "apa_mentioned": false,
    "group_structure_changes": null,
    "strategy_highlights": null,
    "mgmt_commentary_on_results": null,
    "risk_flags": []
  }
}
```

**Rules:**
- All computable fields (deltas, ETR, etr_deviation) are computed by the skill — never manually entered
- Missing data → `null`, never `0` (unless the actual value is zero)
- `financials_prev = null` for companies in their first year of operation
- `yoy_deltas = null` when `financials_prev` is unavailable

---

## 5. Step 4 — Extraction Template (6 Blocks)

Step 4 is a **quality gate**: the report cannot be started until all 6 blocks are filled.

**Completeness thresholds:**
- Blocks 4A–4D: if >30% of fields are unrecorded (not `null` from confirmed absence, but simply not yet looked up), return to source documents.
- Block 4E (management report): higher threshold — if <50% of fields filled, skip section 10 but do NOT block the report. Management report is supplementary; financial data is mandatory.
- Block 4F (tax): same 30% rule as 4A–4D; tax data is always present in financial statements.

```
=== EXTRACTION TEMPLATE — [Company Name] [Year T] ===

━━━ BLOCK 4A: CURRENT YEAR FINANCIALS (year T) ━━━━━━━━━
Revenue (przychody netto):        ___ PLN
EBIT:                             ___ PLN
Profit before tax (zysk brutto):  ___ PLN
Tax expense:                      ___ PLN
Net profit (zysk netto):          ___ PLN
Total assets:                     ___ PLN
Equity:                           ___ PLN
EBITDA:                           ___ PLN
Depreciation:                     ___ PLN

━━━ BLOCK 4B: PRIOR YEAR FINANCIALS (year T-1) ━━━━━━━━━
[Same fields as 4A — always from comparative column in financial statements]
Year T-1:                         ___

━━━ BLOCK 4C: COST STRUCTURE (T and T-1) ━━━━━━━━━━━━━━━
Personnel costs T / T-1:          ___ / ___ PLN
Depreciation T / T-1:             ___ / ___ PLN
External services T / T-1:        ___ / ___ PLN
Materials & goods T / T-1:        ___ / ___ PLN
Other operating costs T / T-1:    ___ / ___ PLN

━━━ BLOCK 4D: TP TRANSACTIONS (+ r/r delta) ━━━━━━━━━━━
A. Revenue from related parties:
   - [Entity] → [amount T] PLN / [amount T-1] PLN — Δ: ___% — [description]
   TOTAL T: ___ PLN / T-1: ___ PLN

B. Purchases from related parties:
   - [Entity] → [amount T] PLN / [amount T-1] PLN — Δ: ___% — [description]
   TOTAL T: ___ PLN / T-1: ___ PLN

C. Financial income from related parties:
   - dividends: [amount T] PLN / [T-1] PLN from [entity]
   - interest income: [amount T] PLN / [T-1] PLN from [entity]

D. Financial costs to related parties:
   - interest costs: [amount T] PLN / [T-1] PLN to [entity]

E. Balances as of 31.12:
   - Receivables: [amount T] PLN / [T-1] PLN (per entity)
   - Payables: [amount T] PLN / [T-1] PLN (per entity)
   - Financial liabilities: [amount T] PLN / [T-1] PLN (per entity)

ADDITIONAL TRANSACTION TYPES (check all that apply):
□ License / royalty:     entity: ___ rate: ___% amount T/T-1: ___ / ___ PLN
□ Management fees:       entity: ___ scope: ___ amount T/T-1: ___ / ___ PLN
□ R&D services:          direction: ___ entity: ___ amount T/T-1: ___ / ___ PLN
□ Cash pooling:          operator: ___ balance T/T-1: ___ / ___ PLN interest: ___ PLN
□ IRS / FX forward:      entity: ___ notional: ___ FV: ___ PLN
□ Loans (per tranche):   entity | amount | maturity | rate | T-1 balance
□ Guarantees:            amount: ___ PLN beneficiaries: ___ fee: yes/no
□ Recharges:             issued: ___ PLN received: ___ PLN
□ Dividends:             paid: ___ PLN received: ___ PLN
□ Lease from RP:         entity: ___ notional: ___ PLN
□ Other:                 description: ___ amount: ___ PLN

━━━ BLOCK 4E: MANAGEMENT REPORT (sprawozdanie zarządu) ━
Read: YES/NO
TP policy mentioned: YES/NO
APA / advance pricing arrangements mentioned: YES/NO
Group structure changes: [description or NONE]
Strategy & plans: [key points]
Management commentary on results: [quote/paraphrase]
TP risk flags identified in report: [list or NONE]

━━━ BLOCK 4F: TAX PROFILE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tax expense (current):            ___ PLN
Profit before tax:                ___ PLN
ETR computed:                     ___% (tax / profit before tax)
Deviation from 19%:               ___pp
Deferred tax asset:               ___ PLN
Deferred tax liability:           ___ PLN
Deferred tax net:                 ___ PLN (asset positive / liability negative)
Explanation of deviation:         [R&D relief / SEZ exemption / losses / other]
Tax risk level:                   LOW / MEDIUM / HIGH / null
```

---

## 6. Report HTML — Section Changes

### Section 01 — Extended with r/r table

Under the existing `.kpi-grid` (6 cards), add a comparison table `.yoy-table` with three row groups:
- **Wyniki finansowe:** revenue, EBIT, EBIT margin, net profit, EBITDA
- **Struktura kosztów:** personnel costs, external services, depreciation
- **Transakcje TP:** TP purchases, TP sales, financial TP balances (where applicable)

Delta column colour coding:
- Green: improvement (higher revenue, higher margin, lower TP concentration)
- Orange/amber: notable change requiring attention
- Red: deterioration or anomalous change (>200% or <−80% triggers automatic flag)

### Section 03 — Extended with tax block

Under the existing `.metrics-row`, add a `.tax-row` (3-column grid):
- ETR with assessment vs 19% statutory rate
- ETR deviation in pp with explanation
- Deferred tax net with interpretation

### Section 10 — New: Kontekst biznesowy

Rendered only when `mgmt_report.read = true`. Structure:
1. `info-box`: management commentary on results (2–3 sentences)
2. `mgmt-grid` (2 columns): strategy & plans card + group structure changes card
3. TP risk flags list: badge (HIGH/MEDIUM) + description per flag

If `mgmt_report.read = false`: `info-box` with note "Sprawozdanie zarządu niedostępne w e-KRS dla tego okresu sprawozdawczego."

---

## 7. Number Formatting Rules

These rules apply throughout the HTML report (not to `companies.json`, which stores raw integers):

| Context | Format | Example |
|---------|--------|---------|
| Amounts ≥ 1 mln PLN | X,X mln PLN (1 decimal) | 73,5 mln PLN |
| Amounts 100k–999k PLN | XXX tys. PLN | 389 tys. PLN |
| Amounts < 100k PLN | XX XXX PLN | 54 890 PLN |
| Percentage values ≥ 5% | Round to 0 decimal | 27% not 26,7% |
| Percentage values < 5% | 1 decimal | 3,9% not 3,88% |
| YoY deltas ≥ 5% | Round to 0 decimal | +27% |
| YoY deltas < 5% (margins, ratios) | 1 decimal | +0,3pp |
| Ratios (equity ratio, debt/EBITDA) | 2 decimals | 0,80 |
| Negative values | Minus sign prefix, no parentheses | −3,2 mln PLN |

**Rule:** When in doubt, use fewer decimals. This is a report for an analyst, not a data dump.

---

## 8. Error Handling

| Situation | Behaviour |
|-----------|-----------|
| Management report not in e-KRS | `mgmt_report.read = false`, section 10 = info-box with explanation |
| No T-1 data (first year of company) | `financials_prev = null`, r/r table hidden, info-box annotation |
| Profit before tax negative or zero | `etr = null`, tax_risk_level = null, note "ETR nieobliczalny" |
| ETR > 40% or < 0% | `etr = null` (data anomaly), note in `tax_notes` |
| No tax note available (simplified PSR) | `deferred_tax_* = null`, `tax_risk_level` reduced by one level |
| YoY delta > 200% or < −80% | Auto red flag: "Anomalna zmiana — zweryfikuj dane źródłowe" |
| Block 4E < 50% filled | Skill skips section 10, renders: "Sprawozdanie zarządu — dane częściowe" |
| Extraction template > 30% blank | Skill does NOT proceed to report — returns to documents |

---

## 9. Validation Extensions (Step 9)

Extend existing HTML validation script with:
```python
import json

with open('companies.json', encoding='utf-8') as f:
    data = json.load(f)
company = next((c for c in data['companies'] if c['id'] == company_id), None)
financials_prev = company.get('financials_prev') if company else None

# New checks
if financials_prev is not None and 'class="yoy-table"' not in h:
    errors.append("yoy-table missing despite financials_prev data in JSON")
if 'class="tax-row"' not in h:
    errors.append("tax-row block missing from section 03")
section_10_present = '>10 —' in h or 'section-label">10' in h
if section_10_present and 'mgmt-grid' not in h:
    errors.append("section 10 present but mgmt-grid missing")
```

---

## 10. Implementation Sequence

1. **Step 0 — Research** (separate session, output reviewed by user before proceeding)
2. **JSON schema extension** — add new fields to `companies.json` structure
3. **Skill rewrite** — update Steps 4, 6, 8, 9, 10 in `analyze.md`
4. **CSS additions** — new classes to add to `style.css`:
   - `.yoy-table` — comparison table (new)
   - `.tax-row` — 3-column tax metrics grid (new)
   - `.mgmt-grid` — 2-column management cards grid (new)
   - `.rf-list`, `.rf-item`, `.rf-badge` — risk flags list (new)
   - `.info-box` — already exists in style.css; reused in section 10
5. **HTML validation extension** — add new checks to Step 9 script
6. **Re-analyze 3 test companies** — generate fresh reports with new pipeline
   - Existing `companies.json` entries (WB Electronics, Orange Polska, HAVI Service Hub) will be missing the new fields until re-analyzed. Frontend treats `undefined` fields identically to `null` — renders "—". No migration script needed.

---

## 11. Out of Scope

- 3-year trend analysis (would require fetching prior-year filings — separate feature)
- Dashboard changes to `index.html` (separate feature)
- Automated JSON-to-HTML generation (current approach: skill writes HTML directly)
- PwC internal methodology or proprietary benchmarks
