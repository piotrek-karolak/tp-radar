# TP Radar — Claude Code Pipeline

## Project root

All relative paths in this file resolve to: `/Users/piotrkarolak/Claude Code/tp-radar/`

Before running any pipeline step, verify you are working in this directory.

## Trigger command

When the user writes `analizuj [nazwa spółki]` or `analyze [company name]`, execute the full pipeline below. Do not ask for confirmation before starting — begin immediately.

---

## Pipeline — step by step

### Step 1: Company ID

Generate slug from company name:
- Lowercase
- Spaces → hyphens
- Remove legal suffixes: S.A., Sp. z o.o., Sp. z o.o. S.K.A., S.K.A., S.K., sp. j., sp. k.
- Remove double hyphens

Examples:
- "WB Electronics S.A." → `wb-electronics`
- "Asseco Poland S.A." → `asseco-poland`
- "PKN ORLEN S.A." → `pkn-orlen`

### Step 2: KRS number lookup

Use WebSearch: `[company name] KRS numer spółka`

Extract 10-digit KRS number from search results (format: 0000XXXXXX).

If not found → ask user: "Nie znalazłem numeru KRS dla [nazwa]. Podaj numer KRS ręcznie."

### Step 3: Download financial documents from e-KRS

URL: `https://rdf-przegladarka.ms.gov.pl/wyszukaj-podmiot`

Use Playwright MCP to:
1. Navigate to the URL
2. Search by KRS number
3. If multiple years available: take the most recent year (highest year number). Note the year in the report header.
4. Download all available documents:
   - `sprawozdanie.xml` or `.xhtml` — structured financial data (iXBRL)
   - `informacja_dodatkowa.pdf` — notes (related party transactions)
   - `sprawozdanie_zarzadu.pdf` — management report

Save downloaded files to `/tmp/tp-radar-[company-id]/`. Read PDFs using the Read tool with `pages` parameter (max 5 pages at a time).

Fallback: If e-KRS is unavailable or documents missing → try company IR website (investor relations section).

---

### Step 4: Data extraction — READ FIRST, EXTRACT SECOND

**CRITICAL RULE: Do not write the report until you have read the full financial statement and filled in the extraction template below. The case of Orange Polska showed that a partial read (numbers-only extraction) missed half the TP transactions — including a brand license fee worth ~180 mln PLN/year.**

#### 4A. Financial statement — key numbers

**From XML/XHTML or PDF:**
- Revenue (przychody netto ze sprzedaży)
- Operating profit / EBIT (zysk z działalności operacyjnej)
- Net profit (zysk netto)
- Total assets (aktywa razem)
- Equity (kapitał własny)
- EBITDA (EBIT + amortyzacja i odpisy)
- Depreciation & amortisation (amortyzacja)
- Interest costs to related parties (koszty odsetkowe wobec powiązanych)

#### 4B. Mandatory extraction template — complete before Step 5

Before writing the report, fill in this template completely. Leave nothing blank — write "brak danych" if not disclosed.

```
=== EKSTRAKCJA TP — [Company Name] ===

NOTA O TRANSAKCJACH Z PODMIOTAMI POWIĄZANYMI (pełna nota)
----------------------------------------------------------
A. Przychody ze sprzedaży towarów i usług:
   - [Podmiot A] → [kwota] PLN — [opis]
   - [Podmiot B] → [kwota] PLN — [opis]
   RAZEM: [kwota] PLN

B. Zakupy towarów i usług:
   - [Podmiot A] → [kwota] PLN — [opis]
   - [Podmiot B] → [kwota] PLN — [opis]
   RAZEM: [kwota] PLN

C. Przychody finansowe od powiązanych:
   - [dywidendy] → [kwota] PLN od [podmiot]
   - [odsetki] → [kwota] PLN od [podmiot]

D. Koszty finansowe do powiązanych:
   - [odsetki od pożyczek] → [kwota] PLN do [podmiot]

E. Saldo rozrachunków (stan na koniec roku):
   - Należności od powiązanych: [kwota] PLN (per podmiot)
   - Zobowiązania do powiązanych: [kwota] PLN (per podmiot)
   - Zobowiązania finansowe (pożyczki, leasing): [kwota] PLN (per podmiot)

DODATKOWE TRANSAKCJE — sprawdź każdą pozycję osobno
----------------------------------------------------
□ Opłata licencyjna za markę / IP (royalty):
  Podmiot licencjodawcy: ___
  Stawka: ___% [przychodów / EBITDA / inne]
  Kwota (jeśli ujawniona): ___ PLN
  Uwagi: ___

□ Management fees / usługi zarządzania:
  Podmiot: ___
  Opis zakresu: ___
  Kwota: ___ PLN

□ Usługi B+R (badania i rozwój):
  Kierunek: [zakup od grupy / sprzedaż do grupy / obie strony]
  Podmiot: ___
  Kwota: ___ PLN

□ Cash pooling / zarządzanie skarbcem:
  Podmiot operatora: ___
  Saldo depozytów spółki: ___ PLN
  Oprocentowanie: ___
  Przychody z depozytów: ___ PLN

□ Instrumenty pochodne IRS / FX swap z powiązanymi:
  Podmiot: ___
  Nominał: ___ PLN
  Wartość godziwa (FV): ___ PLN
  Wpływ na wynik / OCI: ___ PLN

□ Pożyczki — szczegóły (każda transza osobno):
  [Podmiot] | [kwota] | [termin] | [oprocentowanie — zmienne/stałe/stawka]

□ Gwarancje i poręczenia:
  Kwota udzielonych gwarancji: ___ PLN
  Beneficjenci: ___
  Opłata gwarancyjna (guarantee fee): [tak — ___% / brak info]

□ Refaktury kosztów:
  Kwota refaktur wystawionych: ___ PLN
  Kwota refaktur otrzymanych: ___ PLN
  Mechanizm (pass-through / mark-up): ___

□ Dywidendy:
  Wypłacone do [podmiot]: ___ PLN
  Otrzymane od [podmiot]: ___ PLN

□ Wkłady kapitałowe / dokapitalizowanie:
  Podmiot: ___
  Kwota: ___ PLN
  Cel: ___

□ Leasing z powiązanymi (MSSF 16 / MSR 17):
  Podmiot: ___
  Wartość nominalna umów: ___ PLN
  Zobowiązania z tytułu leasingu: ___ PLN

□ Inne (np. darowizny, fundacje, rozliczenia roamingowe, settlementy):
  Opis: ___
  Kwota: ___ PLN

SPRAWOZDANIE ZARZĄDU — sekcja TP
---------------------------------
□ Sekcja "Transakcje z podmiotami powiązanymi" — przeczytana: TAK/NIE
□ Wzmianki o umowach ramowych z grupą: ___
□ Zmiany struktury grupy w roku: ___
□ Wzmianki o dokumentacji TP / APA / benchmarking: ___
□ Inne istotne informacje TP: ___
```

**Only after the template is completely filled — proceed to Step 5.**

#### 4C. Specific search instructions for iXBRL / XHTML files

If the financial document is in XHTML format (iXBRL), use Python to extract text:

```python
import re, html

with open("/tmp/tp-radar-[company-id]/[plik].xhtml", encoding="utf-8") as f:
    raw = f.read()

text = re.sub(r'<[^>]+>', ' ', raw)
text = html.unescape(text)
text = re.sub(r'\s+', ' ', text)

# Find the related party note
for m in re.finditer(r'Transakcje z podmiotami powiązanymi|Strony powiązane|podmiot.*powiązan', text, re.IGNORECASE):
    if m.start() > 5000:  # skip TOC
        print(text[m.start():m.start()+6000])
        break
```

Then search separately for each transaction type from the template:
- `licencj` — brand/IP licenses
- `management|zarządzan` — management fees
- `badań i rozw` — R&D services
- `cash pool|skarbcem|depozyt` — treasury/cash pool
- `instrument.*pochodn|IRS|swap` — derivatives
- `gwarancj|poręczen` — guarantees
- `refaktur` — cost recharges

---

### Step 5: TP risk assessment

Apply the multi-dimensional framework from the design spec.

**For each identified related party transaction (from the extraction template):**

- Dimension 1 — Transaction type (CRITICAL/HIGH/MEDIUM/LOW per spec rubric)
- Dimension 2 — Jurisdiction of counterparty
- Dimension 3 — Financial profile (4 sub-indicators: EBIT margin, Equity Ratio, Debt/EBITDA, Implied Rate)
- Dimension 4 — Transaction volume relative to revenue
- Dimension 5 — Documentation & compliance signals

Transaction risk = highest level across 5 dimensions.

**Company-level scoring (4 steps):**
- Step A: CRITICAL×3 + HIGH×2 + MEDIUM×1, cap at 10 → base level (≤2 LOW · 3–5 MEDIUM · 6–8 HIGH · 9–10 CRITICAL)
- Step B: Red flags correction (see design spec section 4 for full list)
- Step C: Mitigating factors correction
- Step D: Contextual override if warranted

Full rubric: see `/Users/piotrkarolak/Claude Code/claude-code-guide/docs/superpowers/specs/2026-03-23-tp-radar-design.md`

**For Implied Rate:**
```
implied_rate = koszty odsetkowe wobec powiązanych / ((saldo długu wobec powiązanych rok bieżący + rok poprzedni) / 2)
```
Only compute if both values available. If result > 50% or < 0%: set null (data error).

---

### Step 6: Compute financial metrics

```
equity_ratio = equity / total_assets          (null if either missing)
debt_ebitda  = financial_debt_related / ebitda (null if EBITDA missing or negative)
icr          = ebitda / interest_costs_related (null if no related party interest costs)
implied_rate = (computed above)
```

---

### Step 7: Generate report

Write `reports/[company-id].html` — standalone full HTML report.

**Design reference: use `reports/orange-polska.html` as the CSS and structure template.** Copy the full `<style>` block from that file verbatim — do not modify it. The design uses Playfair Display + DM Mono + DM Sans with warm off-white (#f5f1ea) editorial aesthetic.

**Report sections (9 required, in order):**

```
Navigation: <a href="../index.html" class="back-link">← powrót do dashboardu</a>

1. .report-header
   - .report-eyebrow    → "Analiza ryzyk Transfer Pricing · [standard rachunkowości] [rok]"
   - .report-title      → company name (Playfair Display)
   - .report-subtitle   → one sentence describing the analysis
   - .header-chips      → KRS, city, parent company flag, accounting standard, analysis date, risk chip

2. 01 — Kluczowe dane finansowe (.kpi-grid)
   → KPI boxes: revenue, EBIT, net profit, total assets, equity, EBITDA
   → Use null-safe: show "—" if value missing

3. 02 — Ogólna ocena ryzyk TP (.risk-score-row)
   → Score cards: overall level (sv.high/critical/etc), score (N/10),
     plus the 2–3 most important TP metrics (e.g. brand license rate, loan amount, guarantees)

4. 03 — Wskaźniki finansowe (.metrics-row)
   → Dim3 indicators: EBIT margin, equity ratio, debt/EBITDA, implied rate, ICR
   → Color-code with .mv.ok/.mv.warn/.mv.bad based on thresholds

5. 04 — Struktura grupy (.struct-grid)
   → .info-box with description of group structure and key TP context
   → .struct-card per entity: flag emoji, name, location, ownership %, role
   → Include ALL entities that appear in TP transactions — not just subsidiaries

6. 05 — Transakcje z podmiotami powiązanymi
   → .two-col: purchases table + sales table (with year-over-year comparison)
   → Full financial transactions table (loans, IRS, cash pool, guarantees, dividends)
   → Include every transaction type from the extraction template — nothing omitted

7. 06 — Saldo rozrachunków
   → Table: receivables, payables, financial liabilities per counterparty
   → Year-over-year comparison (2024 vs 2023)

8. 07 — Analiza zidentyfikowanych ryzyk TP (.risk-list)
   → One .risk-card per identified transaction type
   → Each card: .risk-stripe [LEVEL], badge, .risk-title, .risk-amt, .risk-desc with bullets, .risk-rec
   → Order: by risk level DESC, then by transaction value DESC
   → Do not merge transactions — each type gets its own card

9. 08 — Macierz priorytetów (.table-wrap)
   → All transactions ranked: #, transaction name, counterparty, amount, level badge, priority emoji
   → Priority: 🔴 Natychmiastowy / 🟠 Wysoki / 🟡 Standardowy / 🟢 Niski

9. 09 — Uzasadnienie oceny i metodologia (.method-box)
   → Steps A→D scoring rationale
   → Source document reference (filename, e-KRS URL, download date, nota numbers)
   → Limitations disclaimer
```

**Language:** All report content in **Polish**.

**CSS conventions:**
- Copy `<style>` block from `reports/orange-polska.html` verbatim
- Risk level classes: `.CRITICAL`, `.HIGH`, `.MEDIUM`, `.LOW` (uppercase)
- Badge colors via CSS variables: `--critical: #dc2626`, `--high: #ea580c`, `--medium: #b45309`, `--low: #15803d`
- Stripe uses `.risk-stripe.CRITICAL / .HIGH / .MEDIUM / .LOW`

---

### Step 8: Update companies.json

Append new company entry to `companies` array in `companies.json`. Never overwrite existing entries.

JSON entry must include: id, name, krs, analyzed_at (today YYYY-MM-DD), report_file, group_affiliation, financials, related_party_flows, tp_risk (overall, score, top_risks max 5), group.

**financials fields:**
```json
{
  "revenue": number | null,
  "operating_profit": number | null,
  "ebit_margin": number | null,
  "net_profit": number | null,
  "total_assets": number | null,
  "equity": number | null,
  "ebitda": number | null,
  "equity_ratio": number | null,
  "debt_ebitda": number | null,
  "icr": number | null,
  "implied_rate": number | null
}
```

**related_party_flows fields (extended):**
```json
{
  "operational": {
    "purchases": number | null,
    "purchases_pct_revenue": number | null,
    "sales": number | null,
    "sales_pct_revenue": number | null,
    "brand_license_entity": "string | null",
    "brand_license_rate_max_pct": number | null
  },
  "financial": {
    "loans_received_from_rp": number | null,
    "loans_granted": number | null,
    "interest_costs_to_rp": number | null,
    "guarantees_issued": number | null,
    "guarantees_received": number | null,
    "dividends_received": number | null,
    "interest_income": number | null,
    "irs_notional": number | null,
    "treasury_pool_deposits": number | null,
    "financial_income_from_rp": number | null
  }
}
```

Validate JSON after writing:
```bash
python3 -c "import json; d=json.load(open('companies.json')); print(f'OK — {len(d[\"companies\"])} companies')"
```

---

### Step 9: Deploy — ALWAYS ASK FIRST

Before running git commands, show the user:

```
Gotowe — analiza zakończona dla [company name].

Pliki do zatwierdzenia:
  reports/[company-id].html  (nowy)
  companies.json             (zaktualizowany, teraz X spółek)

Czy zatwierdzić i opublikować na GitHub Pages? (git add + commit + push)
```

Wait for user confirmation. If confirmed:

```bash
git add reports/[company-id].html companies.json
git commit -m "analysis: add [company name] TP report"
git push
```

GitHub Pages rebuilds automatically (~30 seconds after push).

---

## Conventions

- Report content: **Polish**
- Code, comments, file names: **English**
- Company ID: lowercase slug, no legal suffixes
- analyzed_at: ISO date (YYYY-MM-DD)
- Amounts in JSON: integers in PLN (not thousands, not millions)
- Null fields: use `null` in JSON — frontend renders "—"
- Numeric formats: ebit_margin = percentage (e.g. 21.7), equity_ratio = decimal (e.g. 0.65), debt_ebitda = ratio (e.g. 4.2), implied_rate = percentage (e.g. 8.5), icr = ratio (e.g. 2.5)
- brand_license_rate_max_pct: percentage (e.g. 1.6 means "do 1,6%")

## Error handling

| Situation | Action |
|-----------|--------|
| KRS not found in search | Ask user for KRS manually |
| e-KRS unavailable (2 failed attempts) | Try company IR website; if also unavailable, inform user |
| PDF missing sections | Generate report with "dane częściowe" annotation |
| Implied rate > 50% or < 0% | Set to null, add note in report |
| git push fails | Inform user, leave local files intact — do not delete partial data |
| Company already in companies.json | Ask user: "Spółka już istnieje w bazie (analiza z [date]). Zaktualizować wpis i nadpisać raport?" |
| Extraction template partially blank | Do NOT proceed — search harder in the document or flag as "brak informacji" with explanation |

## Quality check — before generating report

Before writing the HTML, answer these questions. If any answer is "nie wiem" — go back and read more.

1. Ile typów transakcji TP zidentyfikowałem? (minimum: wszystkie z extraction template)
2. Czy sprawdziłem opłatę licencyjną za markę / IP?
3. Czy sprawdziłem management fees / usługi centralne?
4. Czy sprawdziłem instrumenty pochodne z powiązanymi?
5. Czy sprawdziłem cash pooling / depozyty?
6. Czy każda pozycja z sekcji "Zakupy od Grupy" i "Przychody finansowe" ma przypisaną kategorię?
7. Czy mam dane z poprzedniego roku do porównania (y/y)?
