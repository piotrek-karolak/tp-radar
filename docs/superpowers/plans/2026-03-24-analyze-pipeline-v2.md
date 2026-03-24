# TP Radar — Analyze Pipeline v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/analyze` skill and `companies.json` schema to support r/r financial analysis, management report (sprawozdanie zarządu) extraction, and tax profile assessment — with the HTML report generated entirely from structured JSON data.

**Architecture:** Data-first pipeline where a 6-block extraction template (Step 4) acts as a quality gate. All computable fields (deltas, ETR, ratios) are calculated by the skill and stored in `companies.json`. The HTML report renders exclusively from JSON — zero improvisation. Three new HTML sections: r/r table in 01, tax block in 03, new section 10 (management context).

**Tech Stack:** Markdown skill file (`.claude/commands/analyze.md`), HTML/CSS report, JSON data store (`companies.json`), Python validation scripts (inline in skill), Playwright MCP + pdf-tools MCP for document extraction.

---

## ⚠️ Gate: Task 0 must be approved by user before Tasks 1–7

---

## Task 0: TP Methodology Research

**Purpose:** Before implementing any extraction logic or thresholds, establish the methodological framework from public TP sources. Output is a Markdown document the user reviews and approves.

**Files:**
- Create: `docs/superpowers/specs/2026-03-24-tp-methodology-research.md`

- [ ] **Step 1: Research r/r financial indicators relevant to TP risk**

Search public sources for: which financial dynamics (margin compression, rapid revenue growth, cost structure shifts) are flagged in OECD TP Guidelines Chapter I–III and Polish MF audit practice as TP risk indicators.

Key questions to answer with specific thresholds:
- What r/r revenue growth rate triggers heightened TP scrutiny?
- What EBIT margin range is "normal" for SSC/captive service providers vs. distribution vs. manufacturing?
- What cost ratio changes (e.g., external services / revenue) are TP-relevant?

Sources to consult: OECD TP Guidelines 2022 (esp. Chapters I, II, VII), MF rozporządzenie z dnia 21 sierpnia 2021 r. w sprawie informacji o cenach transferowych, KAS guidelines on TP documentation.

- [ ] **Step 2: Research management report TP signals**

Search for: what disclosures in Polish sprawozdanie zarządu indicate TP risk under OECD Chapter IX (business restructuring), DAC6, and Polish TP regulations.

Key questions:
- What phrases/disclosures signal a business restructuring requiring TP documentation?
- What group structure changes trigger APA or documentation update obligations?
- What is the legal basis for management report TP disclosures in Polish law (KSH art. 49)?

- [ ] **Step 3: Research tax profile TP relevance**

Search for: ETR thresholds and anomalies used by tax authorities (KAS, EU Joint Transfer Pricing Forum) to flag aggressive tax planning. Pillar Two GloBE rules and the 15% minimum rate.

Key questions with specific numbers:
- Below what ETR does a company face elevated TP audit risk?
- What deferred tax patterns indicate aggressive TP (e.g., large DTL from accelerated depreciation on intangibles)?
- How does SEZ/SSE exemption affect ETR interpretation in Poland?

- [ ] **Step 4: Research cost structure TP signals for SSC/captive entities**

Search for: OECD guidance on cost-plus methodology for captive service providers, Polish practice on SSC pricing, benchmarking thresholds for markup on costs.

Key questions:
- What personnel cost / revenue ratio is typical for SSC entities?
- When does external services / revenue ratio indicate non-arm's-length pricing?
- What does the OECD say about "low value-adding services" (LVAS) and the 5% markup safe harbour?

- [ ] **Step 5: Compile research into structured output**

Write `docs/superpowers/specs/2026-03-24-tp-methodology-research.md` with this structure:

```markdown
# TP Methodology Research — Framework for Analyze Pipeline v2

## 1. R/R Financial Indicators
[Specific thresholds and rules derived from research, with source citations]

## 2. Management Report TP Signals
[Specific phrases/disclosures to look for, with legal basis]

## 3. Tax Profile TP Relevance
[ETR thresholds, deferred tax red flags, with source citations]

## 4. Cost Structure Signals for SSC/Captive Entities
[Cost ratios, markup thresholds, safe harbours]

## 5. Updated Scoring Rules
[How findings from above modify the existing 5-dimension scoring rubric in analyze.md]
```

- [ ] **Step 6: Present to user for approval**

Output a summary to the user:
```
Research complete. Key findings:
- R/R signals: [2-3 bullet points with specific thresholds]
- Mgmt report signals: [2-3 key phrases/events to flag]
- Tax: [ETR threshold, key deferred tax flag]
- SSC/captive: [markup safe harbour, cost ratio benchmarks]

Full research: docs/superpowers/specs/2026-03-24-tp-methodology-research.md

Please review and confirm before I proceed to implementation.
```

---

## Task 1: CSS — Add New Classes to style.css

**Files:**
- Modify: `assets/style.css` (currently 970 lines — append new classes at end, before `@media` responsive block at line ~965)

**Note:** `.info-box` already exists at line 935 — do NOT add it again. All 4 blocks below are new.

- [ ] **Step 1: Read the existing style.css end section**

Read `assets/style.css` lines 930–970 to understand the existing `.info-box` and `@media` block before inserting.

- [ ] **Step 2: Add `.yoy-table` styles**

Insert before the `@media` block:

```css
/* ── YoY comparison table (section 01) ── */
.yoy-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 20px;
  margin-bottom: 32px;
}
.yoy-table th {
  text-align: left;
  padding: 8px 14px;
  background: var(--bg);
  color: var(--text-2);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-med);
}
.yoy-table th:not(:first-child) { text-align: right; }
.yoy-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.yoy-table td:not(:first-child) { text-align: right; }
.yoy-table tr:hover td { background: var(--bg); }
.yoy-table tr.yoy-separator td {
  background: var(--bg);
  font-weight: 600;
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 7px 14px;
}
.delta-pos { color: var(--low); font-weight: 600; }
.delta-neg { color: var(--critical); font-weight: 600; }
.delta-warn { color: var(--high); font-weight: 600; }
.delta-neutral { color: var(--text-2); }
```

- [ ] **Step 3: Add `.tax-row` styles**

```css
/* ── Tax profile block (section 03) ── */
.tax-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  margin-bottom: 32px;
}
.tax-metric {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.tax-metric .tv { font-size: 22px; font-weight: 700; margin-bottom: 4px; color: var(--text); }
.tax-metric .tk { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
.tax-metric .tt { font-size: 11px; color: var(--text-3); line-height: 1.45; }
.tax-metric .tv.high  { color: var(--high); }
.tax-metric .tv.ok    { color: var(--low); }
.tax-metric .tv.warn  { color: var(--medium); }
```

- [ ] **Step 4: Add `.mgmt-grid`, `.rf-list` styles**

```css
/* ── Management report section (section 10) ── */
.mgmt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0 20px;
}
.mgmt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px 18px;
  box-shadow: var(--shadow);
}
.mgmt-card-label {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--text-3);
  text-transform: uppercase;
  margin-bottom: 8px;
  font-weight: 600;
}
.mgmt-card-body {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}
.rf-list { margin: 0; padding: 0; list-style: none; }
.rf-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}
.rf-item:last-child { border-bottom: none; }
.rf-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 1px;
  text-transform: uppercase;
}
.rf-badge.HIGH     { background: var(--high-bg); color: var(--high); }
.rf-badge.MEDIUM   { background: var(--medium-bg); color: var(--medium); }
.rf-badge.CRITICAL { background: var(--critical-bg); color: var(--critical); }
```

- [ ] **Step 5: Add responsive rules for new classes**

Inside the existing `@media (max-width: 640px)` block, add:

```css
.tax-row, .mgmt-grid { grid-template-columns: 1fr; }
.yoy-table { font-size: 12px; }
.yoy-table th, .yoy-table td { padding: 7px 10px; }
```

- [ ] **Step 6: Verify style.css is valid**

```bash
python3 -c "
with open('assets/style.css', encoding='utf-8') as f:
    css = f.read()
opens = css.count('{')
closes = css.count('}')
print(f'Braces: {opens} open, {closes} close')
if opens == closes:
    print('OK — brace balance correct')
else:
    print(f'ERROR — imbalance: {opens - closes}')
"
```

Expected: `OK — brace balance correct`

- [ ] **Step 7: Commit**

```bash
git add assets/style.css
git commit -m "feat(styles): add yoy-table, tax-row, mgmt-grid, rf-list CSS classes"
```

---

## Task 2: JSON Schema — Document New Structure

**Purpose:** Update `companies.json` with the new schema structure. This task ONLY documents the schema change — actual data is populated when companies are re-analyzed in Task 7.

**Files:**
- Modify: `companies.json`

- [ ] **Step 1: Read current companies.json structure**

Read `companies.json` to understand the existing schema before modifying.

- [ ] **Step 2: Verify JSON is valid before any changes**

```bash
python3 -c "
import json
with open('companies.json', encoding='utf-8') as f:
    d = json.load(f)
print(f'OK — {len(d[\"companies\"])} companies, JSON is valid')
"
```

- [ ] **Step 3: Add schema comment block at top of companies.json**

Add a `_schema_version` field to the root object documenting the v2 schema:

```json
{
  "_schema_version": "2.0",
  "_schema_notes": "v2 adds: financials.year, financials.cost_structure, financials_prev, yoy_deltas, tax, mgmt_report",
  "companies": [...]
}
```

- [ ] **Step 4: Verify JSON is still valid**

```bash
python3 -c "
import json
with open('companies.json', encoding='utf-8') as f:
    d = json.load(f)
print(f'OK — {len(d[\"companies\"])} companies, schema_version: {d.get(\"_schema_version\", \"missing\")}')
"
```

Expected: `OK — 3 companies, schema_version: 2.0`

- [ ] **Step 5: Commit**

```bash
git add companies.json
git commit -m "feat(schema): bump companies.json to v2 schema, add schema notes"
```

---

## Task 3: Skill — Rewrite Step 4 (Extraction Template)

**Files:**
- Modify: `.claude/commands/analyze.md` (Step 4 section, lines ~44–106)

- [ ] **Step 1: Read the current Step 4 in analyze.md**

Read `.claude/commands/analyze.md` lines 44–125 to understand current 4A/4B template before replacing.

- [ ] **Step 2: Replace Step 4 with new 6-block extraction template**

Replace the entire `## Step 4` section (from `## Step 4: Ekstrakcja danych` through the closing `---`) with:

```markdown
## Step 4: Ekstrakcja danych — QUALITY GATE

**REGUŁA KRYTYCZNA: Nie pisz raportu dopóki nie wypełnisz wszystkich 6 bloków poniżej.**

**Progi kompletności:**
- Bloki 4A–4D i 4F: jeśli >30% pól niezapisanych (nie `null` z potwierdzenia braku, ale po prostu nieuzupełnionych) → wróć do dokumentów.
- Blok 4E (sprawozdanie zarządu): próg 50% — jeśli <50% pól wypełnionych, pomiń sekcję 10 raportu, ale **nie blokuj raportu**.

### Szablon ekstrakcji — wypełnij przed Step 5

```
=== EXTRACTION TEMPLATE — [Nazwa Spółki] [Rok T] ===

━━━ BLOK 4A: FINANSE BIEŻĄCE (rok T) ━━━━━━━━━━━━━━
Przychody netto:                  ___ PLN
EBIT:                             ___ PLN
Zysk brutto (przed podatkiem):    ___ PLN
Podatek dochodowy (bieżący):      ___ PLN
Zysk netto:                       ___ PLN
Aktywa razem:                     ___ PLN
Kapitał własny:                   ___ PLN
EBITDA:                           ___ PLN
Amortyzacja:                      ___ PLN

━━━ BLOK 4B: FINANSE POPRZEDNI ROK (rok T-1) ━━━━━━
[Te same pola co 4A — zawsze z kolumny porównawczej SF]
Rok T-1:                          ___
[wypełnij wszystkie 9 pól jak w 4A]

━━━ BLOK 4C: STRUKTURA KOSZTÓW (T i T-1) ━━━━━━━━━
Koszty pracownicze T / T-1:       ___ / ___ PLN
Amortyzacja T / T-1:              ___ / ___ PLN
Usługi obce T / T-1:              ___ / ___ PLN
Materiały i towary T / T-1:       ___ / ___ PLN
Pozostałe koszty T / T-1:         ___ / ___ PLN

━━━ BLOK 4D: TRANSAKCJE TP (+ delta r/r) ━━━━━━━━━
A. Przychody od podmiotów powiązanych:
   - [Podmiot] → T: ___ PLN / T-1: ___ PLN — Δ: ___% — [opis]
   RAZEM T: ___ PLN / T-1: ___ PLN

B. Zakupy od podmiotów powiązanych:
   - [Podmiot] → T: ___ PLN / T-1: ___ PLN — Δ: ___% — [opis]
   RAZEM T: ___ PLN / T-1: ___ PLN

C. Przychody finansowe od powiązanych:
   - dywidendy: T: ___ PLN / T-1: ___ PLN od [podmiot]
   - odsetki: T: ___ PLN / T-1: ___ PLN od [podmiot]

D. Koszty finansowe do powiązanych:
   - odsetki: T: ___ PLN / T-1: ___ PLN do [podmiot]

E. Salda rozrachunków (31.12):
   - Należności: T: ___ PLN / T-1: ___ PLN (per podmiot)
   - Zobowiązania: T: ___ PLN / T-1: ___ PLN (per podmiot)
   - Zobowiązania finansowe: T: ___ PLN / T-1: ___ PLN (per podmiot)

DODATKOWE TYPY TRANSAKCJI (zaznacz wszystkie):
□ Licencja / royalty:  podmiot: ___ stawka: ___% kwota T/T-1: ___ / ___ PLN
□ Management fees:     podmiot: ___ zakres: ___ kwota T/T-1: ___ / ___ PLN
□ Usługi B+R:          kierunek: ___ podmiot: ___ kwota T/T-1: ___ / ___ PLN
□ Cash pooling:        operator: ___ saldo T/T-1: ___ / ___ PLN odsetki: ___ PLN
□ IRS / FX forward:    podmiot: ___ nominał: ___ FV: ___ PLN
□ Pożyczki (per transza): podmiot | kwota | termin | oprocentowanie | saldo T-1
□ Gwarancje:           kwota: ___ PLN beneficjenci: ___ fee: tak/nie
□ Refaktury:           wystawione: ___ PLN otrzymane: ___ PLN
□ Dywidendy:           wypłacone: ___ PLN otrzymane: ___ PLN
□ Leasing z powiązanymi: podmiot: ___ nominał: ___ PLN
□ Inne:                opis: ___ kwota T/T-1: ___ / ___ PLN

━━━ BLOK 4E: SPRAWOZDANIE ZARZĄDU ━━━━━━━━━━━━━━━━
Przeczytane: TAK/NIE
Polityka TP wzmiankowana: TAK/NIE
APA / porozumienia cenowe wzmiankowane: TAK/NIE
Zmiany struktury grupy: [opis lub BRAK]
Strategia i plany: [kluczowe punkty]
Komentarz zarządu do wyników: [cytat/parafraza]
Red flagi TP ze sprawozdania: [lista lub BRAK]

━━━ BLOK 4F: PROFIL PODATKOWY ━━━━━━━━━━━━━━━━━━━
Podatek dochodowy bieżący:        ___ PLN
Zysk brutto (przed podatkiem):    ___ PLN
ETR obliczony:                    ___% (podatek / zysk brutto)
Odchylenie od 19%:                ___pp
Aktywo z tytułu podatku odrocz.:  ___ PLN
Zobowiązanie z tyt. pod. odrocz.: ___ PLN
Podatek odroczony netto:          ___ PLN (aktywo+/zobowiązanie-)
Wyjaśnienie odchylenia:           [ulga R&D / SSE / straty / inne]
Poziom ryzyka podatkowego:        LOW / MEDIUM / HIGH / null
```

### 4G. Ekstrakcja iXBRL/XHTML

```python
import re, html
with open("/tmp/tp-radar-[id]/[plik].xhtml", encoding="utf-8") as f:
    raw = f.read()
text = re.sub(r'<[^>]+>', ' ', raw)
text = html.unescape(text)
text = re.sub(r'\s+', ' ', text)
for m in re.finditer(r'Transakcje z podmiotami|Strony powiązane', text, re.IGNORECASE):
    if m.start() > 5000:
        print(text[m.start():m.start()+6000]); break
```

Szukaj oddzielnie: `licencj` · `management|zarządzan` · `cash pool|depozyt` · `instrument.*pochodn|IRS` · `gwarancj` · `refaktur` · `podatek odroczony` · `efektywna stawka`
```

- [ ] **Step 3: Verify analyze.md still has correct structure**

```bash
python3 -c "
with open('.claude/commands/analyze.md', encoding='utf-8') as f:
    content = f.read()
steps = [f'## Step {i}' for i in range(1, 12)]
missing = [s for s in steps if s not in content]
if missing:
    print(f'MISSING STEPS: {missing}')
else:
    lines = content.count('\n')
    print(f'OK — all steps present, {lines} lines total')
"
```

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/analyze.md
git commit -m "feat(analyze): rewrite Step 4 with 6-block extraction template incl r/r deltas"
```

---

## Task 4: Skill — Update Step 6 (Calculations) and Add Formatting Rules

**Files:**
- Modify: `.claude/commands/analyze.md` (Step 6 and new formatting section)

- [ ] **Step 1: Replace Step 6 with extended calculations**

Replace the existing `## Step 6: Wskaźniki finansowe` section with:

```markdown
## Step 6: Oblicz wskaźniki finansowe i delty r/r

### 6A. Wskaźniki bieżące (jak poprzednio)

```
equity_ratio = equity / total_assets
debt_ebitda  = financial_debt_related / ebitda   (null jeśli EBITDA ≤0 lub brak)
icr          = ebitda / interest_costs_related    (null jeśli brak kosztów RP)
```

### 6B. ETR i profil podatkowy

```
etr              = tax_expense / profit_before_tax  (null jeśli PBT ≤0)
etr_deviation_pp = etr - 0.19                       (null jeśli etr null)
deferred_tax_net = deferred_tax_asset - deferred_tax_liability
```

Jeśli etr <0% lub >40%: ustaw `etr = null`, zapisz anomalię w `tax_notes`.

### 6C. Delty r/r

```
revenue_pct           = (revenue_T - revenue_T1) / abs(revenue_T1) * 100
ebit_margin_pp        = ebit_margin_T - ebit_margin_T1
net_profit_pct        = (net_profit_T - net_profit_T1) / abs(net_profit_T1) * 100
ebitda_pct            = (ebitda_T - ebitda_T1) / abs(ebitda_T1) * 100
tp_purchases_pct      = (tp_purchases_T - tp_purchases_T1) / abs(tp_purchases_T1) * 100
tp_sales_pct          = (tp_sales_T - tp_sales_T1) / abs(tp_sales_T1) * 100
personnel_costs_pct   = (personnel_T - personnel_T1) / abs(personnel_T1) * 100
external_services_pct = (ext_services_T - ext_services_T1) / abs(ext_services_T1) * 100
```

Jeśli T-1 = 0 lub `financials_prev = null`: delta = null.
Jeśli |delta| > 200% lub < -80%: dodaj adnotację "Anomalna zmiana — zweryfikuj dane źródłowe".

### 6D. Reguły formatowania liczb w raporcie HTML

| Kontekst | Format | Przykład |
|----------|--------|---------|
| Kwoty ≥ 1 mln PLN | X,X mln PLN | 73,5 mln PLN |
| Kwoty 100 tys.–999 tys. PLN | XXX tys. PLN | 389 tys. PLN |
| Kwoty < 100 tys. PLN | XX XXX PLN | 54 890 PLN |
| Wartości % ≥ 5% | Bez miejsc po przecinku | 27% nie 26,7% |
| Wartości % < 5% | 1 miejsce | 3,9% nie 3,88% |
| Delty r/r ≥ 5% | Bez miejsc po przecinku | +27% |
| Delty r/r < 5% (marże, wskaźniki) | 1 miejsce | +0,3pp |
| Wskaźniki (equity ratio, debt/EBITDA) | 2 miejsca | 0,80 |
| Wartości ujemne | Minus przed liczbą, bez nawiasów | −3,2 mln PLN |

**Zasada:** gdy wątpliwość — mniej miejsc po przecinku. To raport dla analityka, nie eksport danych.
```

- [ ] **Step 2: Verify Step 6 is correct in the file**

```bash
grep -n "## Step 6\|6A\|6B\|6C\|6D\|etr\|delta" .claude/commands/analyze.md | head -20
```

Expected: lines showing 6A–6D with etr, delta formulas present.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/analyze.md
git commit -m "feat(analyze): extend Step 6 with ETR, r/r deltas, and number formatting rules"
```

---

## Task 5: Skill — Update Step 8 (HTML Report Sections 01, 03, new 10)

**Files:**
- Modify: `.claude/commands/analyze.md` (Step 8 section — HTML templates for sections 01, 03, 10)

This is the largest task. Read the existing Step 8 carefully before making changes.

- [ ] **Step 1: Read current Step 8 HTML templates**

Read `.claude/commands/analyze.md` lines 186–320 to understand existing section templates.

- [ ] **Step 2: Update the section reference table in Step 8**

Replace the existing `### Wszystkie 9 sekcji` table with:

```markdown
### Wszystkie 11 sekcji (w kolejności)

| # | CSS klasy | Zawartość |
|---|-----------|-----------|
| 00 | `info-box` + grid `risk-card` | Akapit + 3 karty TOP tematów |
| 01 | `.kpi-grid` + `.yoy-table` | KPI (6 kart) + tabela r/r (3 grupy wierszy) |
| 02 | `.risk-score-row` | Poziom, score, 3 kluczowe metryki TP |
| 03 | `.metrics-row` + `.tax-row` | Wskaźniki finansowe + blok podatkowy (ETR) |
| 04 | `.struct-grid` | info-box opisu + struct-card per podmiot |
| 05 | `.two-col` + `.table-wrap` | Zakupy + sprzedaż TP + tabela transakcji finansowych |
| 06 | `.table-wrap` | Saldo rozrachunków y/y per podmiot |
| 07 | `.risk-list` | risk-card per typ transakcji, malejąco wg ryzyka |
| 08 | `.table-wrap` | Macierz priorytetów |
| 09 | `.method-box` | Scoring A→D + źródła + ograniczenia |
| 10 | `.info-box` + `.mgmt-grid` + `.rf-list` | Kontekst ze sprawozdania zarządu |
```

- [ ] **Step 3: Add section 01 r/r table template**

After the existing section 01 description in Step 8, add:

```markdown
#### Sekcja 01 — tabela r/r (po .kpi-grid)

```html
<table class="yoy-table">
  <thead>
    <tr>
      <th>Wskaźnik</th>
      <th>[Rok T]</th>
      <th>[Rok T-1]</th>
      <th>Δ r/r</th>
    </tr>
  </thead>
  <tbody>
    <tr class="yoy-separator"><td colspan="4">Wyniki finansowe</td></tr>
    <tr>
      <td>Przychody netto</td>
      <td>[X,X mln PLN]</td>
      <td>[X,X mln PLN]</td>
      <td class="delta-[pos/neg/warn/neutral]">[+/-X%]</td>
    </tr>
    <!-- EBIT, Marża EBIT (pp), Zysk netto, EBITDA -->
    <tr class="yoy-separator"><td colspan="4">Struktura kosztów</td></tr>
    <!-- Koszty pracownicze, Usługi obce, Amortyzacja -->
    <tr class="yoy-separator"><td colspan="4">Transakcje z podmiotami powiązanymi</td></tr>
    <!-- Przychody TP, Zakupy TP, i główne salda finansowe TP jeśli istnieją -->
  </tbody>
</table>
```

Klasy delta — reguła przypisania:
- `delta-pos` (zielony): poprawa — wyższe przychody, wyższa marża, niższa koncentracja TP
- `delta-neg` (czerwony): delta < −30% lub > +200% na transakcjach TP (anomalia)
- `delta-warn` (pomarańczowy): |delta| ≥ 20% na transakcjach TP lub kosztach pracowniczych; odchylenie marży > 2pp
- `delta-neutral` (szary): zmiana < 20% bez TP-istotności

**Pomijaj tabelę r/r jeśli `financials_prev = null`** — zamiast niej: `<div class="info-box">Dane porównawcze niedostępne — spółka w pierwszym roku działalności.</div>`
```

- [ ] **Step 4: Add section 03 tax block template**

After the existing section 03 description, add:

```markdown
#### Sekcja 03 — blok podatkowy (po .metrics-row)

```html
<div class="tax-row">
  <div class="tax-metric">
    <div class="tv [high/warn/ok]">[ETR%] lub —</div>
    <div class="tk">ETR (efektywna stopa podatkowa)</div>
    <div class="tt">Podatek [X tys.] PLN / zysk brutto [X mln] PLN · Ustawowa: 19%</div>
  </div>
  <div class="tax-metric">
    <div class="tv [high/warn/ok]">[±X,Xpp] lub —</div>
    <div class="tk">Odchylenie ETR od stawki ustawowej</div>
    <div class="tt">[Wyjaśnienie: ulga R&D / SSE / straty z lat ubiegłych / inne]</div>
  </div>
  <div class="tax-metric">
    <div class="tv [high/warn/ok/neutral]">[±X,X mln PLN] lub —</div>
    <div class="tk">Podatek odroczony netto</div>
    <div class="tt">[Aktywo/Zobowiązanie — interpretacja ryzyka]</div>
  </div>
</div>
```

Klasy wartości `tv`:
- `high`: ETR <10% lub >35%; lub duże zobowiązanie odroczone netto (>10% zysku brutto)
- `warn`: ETR 10–14% lub ETR 26–35%; odchylenie >5pp
- `ok`: ETR 15–25% (zakres "normalny")
- `neutral`: dane niedostępne, ETR null, lub zakres 25–26% (graniczny — użyj `ok`)

Jeśli `tax.etr = null`: pokaż "—" w pierwszej karcie z adnotacją.
```

- [ ] **Step 5: Add section 10 template**

At the end of Step 8, after section 09 template, add:

```markdown
#### Sekcja 10 — Kontekst biznesowy (sprawozdanie zarządu)

**Warunek renderowania:**
- `mgmt_report.read = true` → pełna sekcja 10
- `mgmt_report.read = false` → tylko info-box z adnotacją
- Block 4E < 50% wypełniony → info-box "Sprawozdanie zarządu — dane częściowe"

```html
<div class="section-label">10 — Kontekst biznesowy ze sprawozdania zarządu</div>

<!-- Jeśli mgmt_report.read = false: -->
<div class="info-box">Sprawozdanie zarządu niedostępne w e-KRS dla tego okresu sprawozdawczego.</div>

<!-- Jeśli mgmt_report.read = true: -->
<div class="info-box" style="margin-bottom: 16px;">
  [Komentarz zarządu do wyników — 2–3 zdania. Cytuj lub parafrazuj sprawozdanie.]
</div>

<div class="mgmt-grid">
  <div class="mgmt-card">
    <div class="mgmt-card-label">Strategia i plany</div>
    <div class="mgmt-card-body">[Kluczowe punkty strategiczne z perspektywy TP]</div>
  </div>
  <div class="mgmt-card">
    <div class="mgmt-card-label">Zmiany w strukturze grupy</div>
    <div class="mgmt-card-body">[Zmiany podmiotowe, nowe spółki, likwidacje, przejęcia funkcji — lub: Brak zmian strukturalnych w roku [T].]</div>
  </div>
</div>

<ul class="rf-list">
  <li class="rf-item">
    <span class="rf-badge HIGH">HIGH</span>
    <span>[Opis red flaga TP ze sprawozdania — konkretne zdarzenie, nie ogólnik]</span>
  </li>
  <!-- powtórz per red flag — pomijaj sekcję rf-list jeśli brak red flagów -->
</ul>
```

**Jeśli brak red flagów ze sprawozdania:** zamiast `rf-list` wstaw: `<p style="color: var(--text-3); font-size: 13px; margin-top: 8px;">Brak red flagów TP zidentyfikowanych w sprawozdaniu zarządu.</p>`
```

- [ ] **Step 6: Verify analyze.md has all 11 section references**

```bash
python3 -c "
with open('.claude/commands/analyze.md', encoding='utf-8') as f:
    content = f.read()
sections = [f'| {i:02d} |' for i in range(0, 11)]
missing = [s for s in sections if s not in content]
print(f'Missing sections: {missing}' if missing else 'OK — all 11 sections (00-10) referenced')
"
```

- [ ] **Step 7: Commit**

```bash
git add .claude/commands/analyze.md
git commit -m "feat(analyze): update Step 8 HTML templates — r/r table (01), tax block (03), mgmt section (10)"
```

---

## Task 6: Skill — Extend Step 9 Validation and Step 10 JSON Schema

**Files:**
- Modify: `.claude/commands/analyze.md` (Step 9 validation script, Step 10 JSON fields)

- [ ] **Step 1: Read current Step 9 validation script in analyze.md**

Read `.claude/commands/analyze.md` lines 323–352 to understand existing validation.

- [ ] **Step 2: Extend Step 9 with new validation checks**

Add to the existing validation script (after the existing checks, before `if errors:`):

```python
import json

# Load JSON to cross-check HTML vs data
try:
    with open('companies.json', encoding='utf-8') as jf:
        jdata = json.load(jf)
    company_data = next((c for c in jdata['companies'] if c['id'] == company_id), None)
    financials_prev = company_data.get('financials_prev') if company_data else None
    tax_data = company_data.get('tax') if company_data else None
except Exception as e:
    errors.append(f'Could not load companies.json for cross-check: {e}')
    company_data = financials_prev = tax_data = None

# New HTML structure checks
if financials_prev is not None and 'class="yoy-table"' not in h:
    errors.append('yoy-table missing despite financials_prev data in JSON')
if 'class="tax-row"' not in h:
    errors.append('tax-row block missing from section 03')
section_10_present = '>10 —' in h or 'section-label">10' in h
if section_10_present and 'class="mgmt-grid"' not in h:
    errors.append('section 10 present but mgmt-grid missing')
if section_10_present and 'class="mgmt-card-label"' not in h:
    errors.append('section 10 present but mgmt-card missing')
# Formatting checks
import re as _re
exact_zloty = _re.findall(r'\b\d{1,3}(?:\s\d{3}){2,}\s*PLN', h)
if exact_zloty:
    errors.append(f'Exact PLN amounts found (should use mln/tys format): {exact_zloty[:2]}')
```

- [ ] **Step 3: Update Step 10 JSON fields list**

In Step 10 of analyze.md, extend the list of fields to include new v2 fields:

```markdown
## Step 10: Zaktualizuj companies.json

Dodaj lub zaktualizuj wpis w tablicy `companies`. Nigdy nie nadpisuj istniejących wpisów.

### Pola `financials` (rozszerzone v2):
revenue, operating_profit, ebit_margin, net_profit, total_assets, equity, ebitda,
equity_ratio, debt_ebitda, icr, implied_rate, **year** (rok T jako integer),
**cost_structure**: { personnel_costs, depreciation, external_services, materials_and_goods, other_operating_costs }

### Nowe bloki v2:

**`financials_prev`** (te same pola + `year` dla roku T-1; null jeśli pierwszy rok)

**`yoy_deltas`**: revenue_pct, ebit_margin_pp, net_profit_pct, ebitda_pct,
tp_purchases_pct, tp_sales_pct, personnel_costs_pct, external_services_pct

**`tax`**: tax_expense, profit_before_tax, etr, statutory_rate (19.0),
etr_deviation_pp, deferred_tax_asset, deferred_tax_liability, deferred_tax_net,
tax_notes, tax_risk_level // enum: "LOW" | "MEDIUM" | "HIGH" | null

**`mgmt_report`**: read (bool), tp_policy_mentioned (bool), apa_mentioned (bool),
group_structure_changes, strategy_highlights, mgmt_commentary_on_results, risk_flags (array)

### Walidacja po zapisie:
```bash
python3 -c "
import json
with open('companies.json', encoding='utf-8') as f:
    d = json.load(f)
co = next(c for c in d['companies'] if c['id'] == '[company-id]')
required_v2 = ['financials_prev', 'yoy_deltas', 'tax', 'mgmt_report']
missing = [k for k in required_v2 if k not in co]
print(f'Missing v2 fields: {missing}' if missing else f'OK — v2 schema complete for {co[\"name\"]}')
print(f'Total companies: {len(d[\"companies\"])}')
"
```
```

- [ ] **Step 4: Verify analyze.md integrity**

```bash
python3 -c "
with open('.claude/commands/analyze.md', encoding='utf-8') as f:
    content = f.read()
checks = [
    ('## Step 4', 'BLOK 4A'),
    ('## Step 6', '6B. ETR'),
    ('## Step 6', '6C. Delty r/r'),
    ('## Step 8', 'yoy-table'),
    ('## Step 8', 'tax-row'),
    ('## Step 8', 'section-label\">10'),
    ('## Step 9', 'yoy-table missing'),
    ('## Step 10', 'financials_prev'),
]
for step, keyword in checks:
    # Find the step section and check keyword is present after it
    step_pos = content.find(step)
    next_step = content.find('## Step', step_pos + 1)
    section = content[step_pos:next_step] if next_step > 0 else content[step_pos:]
    status = 'OK' if keyword in section else 'MISSING'
    print(f'{status}: {step} contains \"{keyword}\"')
"
```

Expected: all lines show `OK`.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/analyze.md
git commit -m "feat(analyze): extend Step 9 validation and Step 10 JSON schema for v2"
```

---

## Task 7: End-to-End Test — Re-analyze One Company

**Purpose:** Run the full new pipeline on one existing company (HAVI Service Hub recommended — smallest, most complete data) to verify the end-to-end flow works correctly.

**Note:** This task requires actual e-KRS document access. If documents are cached in `/tmp/`, use cached versions.

- [ ] **Step 1: Run `/analyze` on HAVI Service Hub**

```
analizuj HAVI Service Hub Sp. z o.o.
```

The skill should:
1. Download/use cached documents from e-KRS
2. Fill all 6 extraction blocks (4A–4F)
3. Compute ratios + deltas in Step 6
4. Generate HTML with sections 00–10
5. Pass Step 9 validation
6. Update companies.json with v2 schema

- [ ] **Step 2: Verify HTML output**

Run the Step 9 validation script from the skill. Expected: `OK — wszystkie sprawdzenia przeszły.`

- [ ] **Step 3: Verify JSON output**

```bash
python3 -c "
import json
with open('companies.json', encoding='utf-8') as f:
    d = json.load(f)
co = next(c for c in d['companies'] if c['id'] == 'havi-service-hub')
v2_fields = ['financials_prev', 'yoy_deltas', 'tax', 'mgmt_report']
for field in v2_fields:
    val = co.get(field)
    print(f'{field}: {\"present\" if val is not None else \"null/missing\"}')
print(f'financials.year: {co[\"financials\"].get(\"year\")}')
print(f'tax.etr: {co[\"tax\"].get(\"etr\")}')
"
```

- [ ] **Step 4: Visual check in browser**

Open `reports/havi-service-hub.html` in browser and verify:
- Section 01 has r/r table with 3 row groups
- Section 03 has tax block below metrics
- Section 10 is present with mgmt-grid and rf-list

- [ ] **Step 5: Re-analyze remaining 2 companies**

```
analizuj WB Electronics S.A.
analizuj Orange Polska S.A.
```

- [ ] **Step 6: Final commit**

```bash
git add reports/ companies.json
git commit -m "analysis: re-analyze WB Electronics, Orange Polska, HAVI Service Hub with v2 pipeline"
git push
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `assets/style.css` | Modify | Add ~80 lines: `.yoy-table`, `.tax-row`, `.mgmt-grid`, `.rf-list` + responsive |
| `companies.json` | Modify | Add `_schema_version: 2.0` + re-populated v2 data in Task 7 |
| `.claude/commands/analyze.md` | Modify | Step 4 (6-block template), Step 6 (ETR + deltas + formatting), Step 8 (sections 01/03/10), Step 9 (extended validation), Step 10 (v2 JSON fields) |
| `docs/superpowers/specs/2026-03-24-tp-methodology-research.md` | Create | Research output (Task 0) — user-gated |

---

## Dependencies

```
Task 0 (Research) ──[user approval]──► Tasks 1–6 (can run in sequence)
Tasks 1–6 ──────────────────────────► Task 7 (end-to-end test)
```

Tasks 1–6 are independent of each other and can technically be done in any order, but the recommended sequence is: 1 (CSS) → 2 (JSON schema) → 3 (Step 4) → 4 (Step 6) → 5 (Step 8) → 6 (Step 9/10).
