# TP Radar — Claude Code Pipeline

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
3. Find the most recent financial statement year
4. Download all available documents:
   - `sprawozdanie.xml` — structured financial data
   - `informacja_dodatkowa.pdf` — notes (related party transactions)
   - `sprawozdanie_zarzadu.pdf` — management report

Save to `.playwright-mcp/` or a temp directory. Read PDFs using the Read tool with `pages` parameter (max 5 pages at a time).

Fallback: If e-KRS is unavailable or documents missing → try company IR website (investor relations section).

### Step 4: Data extraction

**From XML (sprawozdanie.xml):**
- Revenue (przychody netto ze sprzedaży)
- Operating profit / EBIT (zysk z działalności operacyjnej)
- Net profit (zysk netto)
- Total assets (aktywa razem)
- Equity (kapitał własny)
- Total financial liabilities / debt
- EBITDA (EBIT + amortyzacja)
- Financial costs (koszty finansowe)
- Interest costs paid to related parties

**From notes PDF (informacja_dodatkowa.pdf):**
- Table of related party transactions — all types:
  - Operational: purchases, sales (per counterparty, per amount)
  - Financial: loans granted/received, guarantees issued/received, cash-pooling, leasing, factoring, derivatives, dividends
- Group structure: subsidiaries list with country, ownership %, role
- Balances: receivables from related parties, payables to related parties
- Any mention of TP documentation, APA, benchmarking

**From management report (sprawozdanie_zarzadu.pdf):**
- Business model description (2-3 sentences)
- Risk factors mentioning TP, tax, transfer pricing
- Any mention of restructuring, mergers, function transfers
- Going concern doubts (if any)
- Investment plans with related parties

### Step 5: TP risk assessment

Apply the multi-dimensional framework from the design spec.

**For each identified related party transaction:**

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

Full rubric: see `docs/superpowers/specs/2026-03-23-tp-radar-design.md` in the `claude-code-guide` project.

**For Implied Rate:**
implied_rate = koszty odsetkowe wobec powiązanych / ((saldo długu wobec powiązanych rok bieżący + rok poprzedni) / 2)
Only compute if both values available. If result > 50% or < 0%: set null (data error).

### Step 6: Compute financial metrics

```
equity_ratio = equity / total_assets  (null if either missing)
debt_ebitda = financial_debt_related / ebitda  (null if EBITDA missing or negative)
icr = ebitda / interest_costs_related  (null if no related party interest costs)
implied_rate = (computed above)
```

### Step 7: Generate report

Write `reports/[company-id].html` — standalone full HTML report with all 8 sections.

**Report structure (required sections in order):**
1. Back link: `<a href="../index.html" class="back-link">← Powrót do dashboardu</a>`
2. Header — company name, KRS, date, risk badge (e.g. "⚠ Ryzyko TP: WYSOKIE"), meta-chips
3. Key financials summary — KPI boxes (revenue, net profit, RP purchases, RP sales, guarantees if applicable)
4. Group structure — cards per subsidiary with country flag emoji, ownership %, role
5. Transactions table — all RP transactions split: operational purchases / sales / financial (use `.two-col` grid)
6. Balance of settlements — receivables and payables to related parties
7. Risk analysis — one card per identified risk with: color stripe, level badge, description with amounts, recommendation
8. Priority matrix table — all risks ranked by amount × level with priority labels
9. Source & methodology footer — e-KRS URL, analysis date, generated by Claude Code

**CSS conventions for generated reports:**
- Embed ALL CSS in `<style>` in `<head>` — no external CSS files
- Risk level classes use UPPERCASE: `.CRITICAL`, `.HIGH`, `.MEDIUM`, `.LOW`
- Risk stripe colors: CRITICAL = #dc2626, HIGH = #ea580c, MEDIUM = #ca8a04, LOW = #16a34a
- Back link class: `.back-link { display: inline-block; margin: 16px 24px; color: #005a9e; text-decoration: none; font-size: 14px; }`
- Use the WB Electronics report (`reports/wb-electronics.html`) as the style reference

**Language:** All report content in **Polish**.

### Step 8: Update companies.json

Append new company entry to `companies` array in `companies.json`. Never overwrite existing entries.

JSON entry must include: id, name, krs, analyzed_at (today YYYY-MM-DD), report_file, group_affiliation, financials (with null for unavailable fields), related_party_flows, tp_risk (overall, score, top_risks max 5), group.

financials fields:
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

Validate JSON after writing:
```bash
python3 -c "import json; d=json.load(open('companies.json')); print(f'OK — {len(d[\"companies\"])} companies')"
```

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

## Error handling

| Situation | Action |
|-----------|--------|
| KRS not found in search | Ask user for KRS manually |
| e-KRS unavailable | Try company IR website |
| PDF missing sections | Generate report with "dane częściowe" annotation |
| Implied rate > 50% or < 0% | Set to null, add note in report |
| git push fails | Inform user, leave local files intact — do not delete partial data |
