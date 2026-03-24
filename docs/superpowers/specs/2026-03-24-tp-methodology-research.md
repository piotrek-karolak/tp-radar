# TP Methodology Research — Framework for Analyze Pipeline v2

**Date:** 2026-03-24
**Status:** Draft — pending user review
**Sources consulted:**
- OECD Transfer Pricing Guidelines 2022 (Chapters I, VII, IX, X) — oecd.org
- OECD Pillar Two GloBE Model Rules & Implementation Handbook — oecd.org
- OECD Country Profile: Poland (October 2025) — oecd.org/tax/transfer-pricing/transfer-pricing-country-profile-poland.pdf
- Polish Accounting Act (Ustawa o rachunkowości), art. 49 — lexlege.pl
- Rozporządzenie MF z 29 sierpnia 2022 r. w sprawie informacji o cenach transferowych (TPR-CIT) — isap.sejm.gov.pl
- Deloitte Poland: Raport — Kontrole cen transferowych 2024 (published May 2025) — deloitte.com/pl
- KAS / podatki.gov.pl — official transfer pricing guidance
- PwC: Poland Corporate Taxes & Pillar Two SEZ impact — taxsummaries.pwc.com / studio.pwc.pl
- Woźniak Legal: Transfer pricing enforcement in Poland — wozniaklegal.com
- BDO Malta: OECD LVAS guidance summary — bdo.com.mt
- Bloomberg Tax: DAC6 and TP hallmarks — bloombergtax.com
- International Tax Review: Chapter IX restructurings & controversy — internationaltaxreview.com
- APQC / ScottMadden: SSC operating cost benchmarks — apqc.org / scottmadden.com
- ArmsLength AI / Quantera Global: TNMM benchmarking methodology — armslength.ai / quanteraglobal.com

---

## 1. R/R Financial Indicators Relevant to TP Risk

### 1.1 Revenue Growth Thresholds

OECD TPG 2022 Chapter I does not prescribe a specific r/r revenue growth percentage as a universal TP risk threshold. Instead, para. 1.57–1.58 require that "significant changes in financial performance" be explained by reference to actual market conditions and business circumstances, with tax administrations entitled to scrutinise whether the change stems from legitimate economic reasons or from profit-shifting arrangements.

**Operative principle:** When a Polish entity's revenue growth diverges materially from its sector benchmark, KAS treats this as a "significant change" requiring functional re-examination.

**Polish practice (KAS) — derived from regulatory guidance and Deloitte 2024 audit report:**

| Scenario | Risk signal level |
|---|---|
| Revenue **↑ >30% r/r** while EBIT margin **↓ or flat** | HIGH — potential underpricing of intercompany sales |
| Revenue **↓ >20% r/r** combined with stable overhead base | HIGH — potential overpricing of intragroup purchases |
| Revenue growth sustained but entity books **multi-year losses** | CRITICAL — inconsistent with routine functional profile |
| Revenue growth aligned with sector average, stable margins | LOW |

**Note:** No single r/r growth rate automatically triggers a Polish TP audit. The trigger is the *combination* of revenue growth trajectory with margin compression and the entity's functional profile (routine vs. entrepreneurial).

---

### 1.2 EBIT Margin Benchmarks by Entity Type

Based on OECD TNMM benchmarking practice and Polish benchmarking databases (BvD Orbis / TP Catalyst):

| Entity type | Typical arm's length EBIT margin (IQR) | TP risk signal |
|---|---|---|
| **SSC / captive service provider** (routine) | 3% – 12% (median ~6–8%) | Below 2% or above 20%: scrutiny |
| **Limited-risk distributor** | 0.5% – 5% (median ~2–3%) | Loss position (< 0%) or > 8%: re-examine |
| **Full-fledged distributor** | 2% – 10% (median ~4–5%) | Loss 2+ consecutive years: HIGH risk |
| **Contract / toll manufacturer** | 1% – 6% (median ~3–4%) | Negative EBIT for routine entity: CRITICAL |
| **Full-fledged manufacturer** | 4% – 15% (median ~7–8%) | Below 1%: examine cost allocation |
| **R&D service provider** (routine) | 5% – 15% (median ~8%) | Below 3%: examine R&D recharge rates |

**Key OECD principle (para. 2.87–2.111 TPG 2022):** A routine entity should earn a stable, relatively predictable margin. A loss position in a routine entity is a primary TP risk signal because independent companies with limited risk would exit a market before accepting losses.

**Interquartile range methodology:** Polish TP documentation must demonstrate results within the IQR (P25–P75) of comparables. Results below P25 are a risk flag; results below or at P10 warrant mandatory explanation in the TPR form.

---

### 1.3 Cost Ratio Signals

The following cost ratio shifts are TP-relevant under OECD Chapter I and Polish TPR reporting practice:

| Cost ratio | Normal range | TP risk signal |
|---|---|---|
| **External services / revenue** | 5% – 25% (sector-dependent) | Sharp increase (>5 pp r/r) without operational explanation; especially if paid to group entities |
| **Intragroup services costs / total OPEX** | < 20% for operational entities | >30% suggests overcharge for management / IT / IP fees |
| **Personnel costs / total costs** (SSC) | 50% – 75% | Drop below 40% may indicate cost base manipulation |
| **R&D expenses / revenue** | 2% – 8% (tech/pharma higher) | R/r decline >3 pp combined with IP transfer signals restructuring |
| **Depreciation / revenue** | sector-specific | Spike (>3 pp r/r) after intragroup asset transfer: examine arm's length value |
| **Interest costs / EBITDA** (debt-EBITDA) | < 3.0× for standard entities | > 4.5× signals thin capitalisation / related-party financing risk |

**Polish thin capitalisation rules (art. 15c CIT Act):** Interest deductibility capped at 30% of EBITDA + PLN 3M. Entities with debt/EBITDA > 3× and high interest charges to group entities are primary KAS audit targets for financial transaction TP.

---

### 1.4 OECD Position on Financial Performance Changes

**Para. 1.57 TPG 2022 (Comparability analysis — financial indicators):**
> "Where there have been significant changes in the relevant comparability factors or in the controlled transactions themselves from one year to the next, careful consideration needs to be given to the possibility that the nature of the transactions has changed in a way that affects the appropriate pricing."

**Key OECD positions:**

1. **Multi-year data preferred:** TPG para. 3.75–3.79 recommend using multiple-year data (typically 3 years) to distinguish cyclical from structural performance changes. A single year of losses in a cyclical business is less suspicious than sustained multi-year losses.

2. **Routine entity losses as red flag:** Para. 1.47 states that a routine, limited-risk entity should not systematically bear losses. Sustained losses indicate either: (a) the entity is not truly limited-risk, or (b) intercompany prices are non-arm's-length.

3. **BEPS Action 13 Country-by-Country Report (CbCR):** For MNE groups with consolidated revenue ≥ EUR 750M, CbCR data allows tax authorities to identify jurisdictions where profit allocation is inconsistent with substance. Poland uses CbCR data actively for audit selection.

4. **Comparability with external benchmarks:** Para. 1.33 — "significant deviations from industry average profitability" require explanation. KAS cross-references TPR-reported margins against sector medians.

---

## 2. Management Report TP Signals

### 2.1 Business Restructuring Triggers (OECD Chapter IX)

**Definition (para. 9.1 TPG 2022):** Business restructuring = "cross-border reorganisation of the commercial or financial relations between associated enterprises, including the termination or substantial renegotiation of existing arrangements."

**Events that trigger Chapter IX TP documentation requirement:**

| Event | Documentation trigger | Key OECD reference |
|---|---|---|
| Conversion of **full-fledged distributor** → limited-risk distributor / commissionnaire | YES — transfer of profit potential | Para. 9.2, 9.59 |
| Conversion of **full-fledged manufacturer** → contract/toll manufacturer | YES — transfer of manufacturing risk + intangibles | Para. 9.2, 9.60 |
| **Centralisation of functions** to a group hub (procurement, treasury, IP) | YES — if accompanied by transfer of functions, assets or risks | Para. 9.14–9.20 |
| **Transfer of intangibles** (IP, customer lists, know-how) to group entity | YES — arm's length valuation required | Para. 9.83–9.92 |
| **Transfer of an ongoing concern** (people + processes + contracts) | YES — comparable to business sale | Para. 9.96–9.104 |
| Termination / **non-renewal of existing agreement** (e.g., distribution, manufacturing) | Potentially YES — if the entity loses profit potential, indemnification required | Para. 9.106–9.114 |
| **Guarantee / security transfer** to group entity | Examine — financial restructuring | Chapter X TPG 2022 |

**Key principle — arm's length indemnification:** Para. 9.9 establishes that if an independent entity would have demanded compensation for the loss of profit potential (e.g., termination payment, goodwill payment), the group entity should receive equivalent compensation. Absence of such compensation is a TP red flag.

**Profit potential test (para. 9.105):** An arm's length indemnification is required when the restructuring results in the entity surrendering "reasonably anticipated profits." A typical example: a full-fledged distributor converted to a limited-risk agent loses the upside of market risk — an independent entity would demand exit compensation.

---

### 2.2 Mandatory Disclosures in Polish Law (KSH art. 49 / Ustawa o rachunkowości)

**Legal basis:** Ustawa o rachunkowości, art. 49 (sprawozdanie z działalności) + art. 2 ust. 1 KSH for capital companies.

**What must be disclosed:**

1. **Material related-party transactions on non-arm's-length terms** — with description, amounts, and explanation of why terms differ from market (art. 49 ust. 2 pkt 6 u.r.)
2. **Information about agreements with members of management / supervisory boards** — including any compensation arrangements with group entities
3. **Significant events after balance sheet date** — including intercompany restructurings, asset transfers, new financing arrangements
4. **Going concern risks** — if entity's financial health depends on group support, this must be stated
5. **For public companies (KSH art. 300 + Rozporządzenie MAR):** Significant related-party transactions require shareholder approval and immediate disclosure if materially significant

**Note on scope difference:** Polish u.r. defines "jednostki powiązane" through capital ties (shareholding), while CIT Act (ustawa o CIT art. 11a) uses broader functional control criteria (25% ownership OR management control). TP risk analysis should apply the CIT Act definition, which is broader.

---

### 2.3 DAC6 Red Flag Phrases

**DAC6 in Poland (MDR — Mandatory Disclosure Rules, effective January 2019):** Poland implemented DAC6 with broader scope — applies to both cross-border and **domestic** arrangements, and a wider range of taxes (not just income tax).

**TP-specific DAC6 hallmarks (Category E — must be reported regardless of main benefit test):**

| Hallmark | What to look for in management report |
|---|---|
| **E.1 — Cross-border transfer of functions/risks/assets** | Projected to reduce transferor's profits by >50% over next 3 years |
| **E.2 — Hard-to-value intangibles (HTVI) transfer** | Transfer of IP where valuation is highly uncertain at transaction time |
| **E.3 — Unilateral safe harbour arrangements** | Use of LVAS 5% markup, simplified APA pricing rules |

**DAC6 Hallmark D — Tax transparency undermining:** Arrangements that undermine reporting obligations, e.g., non-standard intercompany structures designed to obscure beneficial ownership.

**Polish MDR broader scope (domestic arrangements):** Any tax arrangement with a "standardised" structure generating >PLN 5M tax benefit, or >PLN 25M if used by multiple taxpayers.

---

### 2.4 Red Flags Checklist

The following phrases and events in the sprawozdanie zarządu / sprawozdanie finansowe should trigger elevated TP risk scoring:

**Group structure / restructuring signals:**
- [ ] "restrukturyzacja grupy" / "reorganizacja modelu operacyjnego"
- [ ] "centralizacja funkcji" / "centralisation of [purchasing / treasury / IP / HR]"
- [ ] "przeniesienie [funkcji / aktywów / ryzyk] do [entity name]"
- [ ] "zmiana modelu dystrybucji" / "change in distribution model"
- [ ] "konwersja do modelu komisionanta" / "commissionnaire arrangement"
- [ ] "umowa o zarządzanie" / "management services agreement" — first mention or material change
- [ ] "umowa licencyjna" — new IP licensing arrangement with group entity
- [ ] New APA (advance pricing agreement) mention or APA application filed

**Financial performance anomalies:**
- [ ] "strata z działalności operacyjnej" — operating loss, especially for routine entity
- [ ] "wynik niższy od zakładanego" combined with high intercompany charges
- [ ] "dofinansowanie od jednostki dominującej" — group subsidy indicating below-arm's-length pricing
- [ ] Multi-year consecutive losses in entity with "low-risk" profile

**Intercompany financing signals:**
- [ ] New intercompany loan at unusual rate (very high or very low vs. market)
- [ ] "pożyczka od jednostki powiązanej" with terms not comparable to external
- [ ] "gwarancja udzielona przez podmiot powiązany" without fee or at below-market fee
- [ ] Cash pooling arrangement (pooling — beneficial ownership of interest must be assessed)

**Regulatory / compliance signals:**
- [ ] "postępowanie podatkowe" / "kontrola podatkowa" — active TP audit in progress
- [ ] "korekta cen transferowych" — voluntary or imposed TP adjustment
- [ ] "interpretacja indywidualna" — tax ruling sought on intercompany pricing
- [ ] "uprzednie porozumienie cenowe (APA)" — APA application or existing APA
- [ ] "MDR" / "DAC6" — mandatory disclosure reported

---

## 3. Tax Profile TP Relevance

### 3.1 ETR Thresholds for TP Risk Assessment

**Polish standard CIT rate:** 19%
**Reduced CIT rate:** 9% (for small taxpayers: revenue ≤ EUR 2M; and entities in first year of activity)
**SEZ / PIZ exemption:** Effective CIT rate can be 0–5% for income qualifying for special economic zone exemption
**Pillar Two GloBE minimum:** 15%

| ETR range | Risk level | Action for TP analyst |
|---|---|---|
| ETR **= 19% ± 1 pp** (18–20%) | LOW | Standard monitoring |
| ETR **15% – 18%** | MEDIUM | Investigate: R&D relief, IP box, donations — are these legitimate or TP-driven? |
| ETR **9% – 15%** | HIGH | Flag: check if 9% reduced rate applies; if not, investigate deferred tax, exemptions, or non-arm's-length charges reducing taxable income |
| ETR **< 9%** (non-SEZ entity) | CRITICAL | Likely TP issue or aggressive tax planning — mandatory deep-dive |
| ETR **0% – 9%** (SEZ/PIZ entity) | CONTEXT-DEPENDENT | Verify SEZ exemption scope; check if Pillar Two top-up applies |
| ETR **> 28%** | MEDIUM | Investigate: large non-deductible costs (could include TP adjustments from previous year), deferred tax reversal |
| ETR **negative** | HIGH | Examine large deferred tax assets — could indicate recognition of uncertain TP position |

**Note on "implied ETR" calculation in TP Radar:** Use `current_tax_charge / EBT_before_tax`. If deferred tax is large (>5% of EBT), report separately, as deferred tax does not reflect the current economic TP risk profile.

---

### 3.2 Polish-Specific ETR Adjustments

**When ETR below 19% is NOT a TP red flag:**

1. **Small taxpayer (9% rate):** Applicable when prior-year revenue ≤ EUR 2M. For HAVI-type SSC entities operating as captive providers, this is unlikely to apply given typical revenue scale.

2. **SEZ / PIZ (Polish Investment Zone) CIT exemption:** Income from qualifying activities in a decision support area is CIT-exempt. ETR can legitimately be 0–12% depending on aid intensity. For TP analysis, the critical question is: **is the transfer price designed to concentrate exempt income in the SEZ entity and shift taxable income elsewhere?**

3. **R&D relief (ulga B+R):** Additional 100–200% cost deduction for qualifying R&D costs. Reduces taxable income and ETR legitimately. Watch for: is the entity claiming R&D relief for costs that are actually group service recharges (non-qualifying)?

4. **Innovation Box (IP Box, art. 24d CIT Act):** 5% preferential rate on qualifying IP income. If an entity earns significant intercompany royalties at below-market rates while claiming IP Box, this is a dual TP risk (both IP valuation and ETR anomaly).

5. **Unrealised FX on intercompany loans:** Can distort ETR significantly in a given year without underlying TP issue.

**Key diagnostic question:** Is the ETR deviation explainable by one of the above legitimate mechanisms, documented in the sprawozdanie zarządu or note to financial statements?

---

### 3.3 Pillar Two Implications for Polish Subsidiaries

**Scope:** MNE groups with consolidated annual revenues ≥ EUR 750M in at least 2 of the 4 preceding fiscal years.

**Polish implementation (in force from January 1, 2025):**
- **GCT (Global Compensatory Tax):** Polish parent tops up foreign subsidiary below-15% ETR
- **NCT (National Compensatory Tax):** Poland tops up Polish subsidiary ETR to 15% if it falls below — expected to affect several thousand Polish entities
- **UPT (Undertaxed Profits Tax):** Backstop rule, applies from 2026

**First Polish reporting deadline:** June 30, 2026 (for fiscal year 2025)

**Implications for TP analysis of Polish entities:**

1. **SEZ/PIZ entities at risk:** PwC analysis confirms that SEZ/PIZ CIT exemptions do **not** automatically exempt from Pillar Two NCT. A Polish manufacturing subsidiary earning exempt income could face NCT if its GloBE ETR falls below 15%.

2. **TP and GloBE interaction:** Transfer pricing adjustments affect GloBE taxable income (GloBE Income = accounting profit ± defined adjustments). Non-arm's-length intercompany pricing that artificially reduces Polish taxable income also reduces GloBE ETR, potentially triggering NCT.

3. **Substance-based income exclusion (SBIE):** GloBE provides a carve-out for substance: 5% of tangible asset value + 5% of payroll costs (transitional rates: 8%/10% for 2025). Polish entities with significant operational substance (high payroll, significant fixed assets) will have a higher SBIE, reducing top-up tax exposure.

4. **ALP / TP adjustments:** MNE groups are increasingly adjusting intercompany prices to keep Polish subsidiary ETR at or above 15%, changing the incentive structure for TP planning.

---

### 3.4 Deferred Tax Red Flags

| Pattern | TP risk interpretation |
|---|---|
| **Large deferred tax asset (DTA) on tax losses** | Suggests expected future profitability — examine if losses were TP-driven (overcharges from group) |
| **Large DTA on receivables provisions** | Less TP-relevant; examine if receivables include intercompany items provisioned at inflated values |
| **Large deferred tax liability (DTL) on intangibles** | Indicates intangibles recognised above tax base — potential HTVI / IP transfer issue; examine if IP was recently transferred into the entity |
| **DTL reversal risk** (large DTL + declining revenue) | If IP or brand value declines post-transfer, DTL reversal could signal original transfer was overvalued |
| **DTA on "other temporary differences" not explained** | Investigate: could indicate TP adjustments recognised as timing differences |
| **Dramatic ETR increase/decrease vs. prior year** (>5 pp shift) | Examine: voluntary TP adjustment, contested KAS assessment, deferred tax reclassification |

---

## 4. Cost Structure Signals for SSC/Captive Entities

### 4.1 OECD LVAS Safe Harbour

**Source:** OECD TPG 2022, Chapter VII, Section D.1 (para. 7.45–7.63)

**What LVAS safe harbour provides:**
- Simplified cost-plus pricing: **cost base × (1 + 5% markup)** — no need for benchmarking study
- Streamlined documentation: pooled cost schedule across all recipients is sufficient
- No country-specific benchmarking required if 5% markup applied consistently

**Eligible LVAS services (para. 7.45):**
- IT support (non-core)
- Human resources administration
- Accounting and financial reporting (back office)
- Legal services (routine compliance)
- Communications and PR support
- Tax compliance services
- General administrative services

**Excluded services — LVAS safe harbour does NOT apply to:**
- Services that constitute a core/principal activity of the MNE group
- Services involving **unique intangibles** (patents, know-how, trade secrets)
- Services involving **significant risk assumption** (insurance captive, financing)
- Services in the nature of **R&D** (even if outsourced to SSC)
- **Manufacturing** activities
- Natural resource extraction / exploration
- Sales, marketing, and distribution in active market-facing roles
- Transactions with **tax haven entities** (Polish MDR rules apply additionally)

**Conditions for applying the 5% markup (para. 7.50–7.56):**
1. Services must be genuinely low value-adding (not strategic, not core)
2. Cost pool must be properly defined (direct + indirect costs, excluding pass-through costs if clearly identifiable)
3. Allocation key must be reasonable and consistently applied
4. The MNE must prepare a benefits test: demonstrate that each recipient derives an economic/commercial benefit

**Cost base for LVAS:** Fully-loaded cost (direct + indirect costs allocated to the service activity). Pass-through costs (costs incurred on behalf of the recipient with no value added, e.g., third-party travel expenses reimbursed at cost) may be excluded from the markup base, but must be separately identified.

---

### 4.2 Benchmark Ranges for SSC Entities

Based on OECD TNMM benchmarking practice, APQC operational benchmarks, and Polish TP practice:

| Metric | Typical arm's length range | TP risk signal threshold |
|---|---|---|
| **EBIT margin** (return on costs) | 3% – 12% | Below 2%: underpricing; above 20%: examine if truly routine |
| **Operating cost markup** (cost-plus) | 5% – 15% | Below 3%: may indicate cost undercharge to group; above 20%: overcharge risk |
| **Personnel costs / total revenue** | 50% – 75% | Below 40%: examine cost base integrity; above 80% may indicate high-cost captive |
| **Personnel costs / total operating costs** | 60% – 80% | Sharp decline (>10 pp r/r): examine if cost base shifted to external services |
| **External services / total revenue** | 10% – 30% | Increase >10 pp r/r without explanation: examine if third-party costs pushed through SSC inflating markup base |
| **Revenue per FTE** | PLN 150K – 350K (Poland) | Below PLN 100K: examine if all costs captured; above PLN 500K: examine if truly routine |
| **Administrative overhead / revenue** | 5% – 15% | Spike >10 pp r/r: examine management fee recharges from parent |

**APQC operational benchmark for finance SSC operating cost:** Top-performing SSCs spend $1.90 per $1,000 of supported revenue; median ~$4–6 per $1,000. These are operational KPIs, not TP benchmarks, but deviations help identify cost structure anomalies.

---

### 4.3 Cost Base for Cost-Plus Method

**Two approaches in OECD Chapter VII and Polish practice:**

**Fully-loaded cost base (standard approach, recommended by OECD para. 7.56):**
- Direct costs: personnel, directly attributable software, direct materials
- Indirect costs: allocated portion of occupancy, IT infrastructure, management overhead
- **Excludes:** Equity returns, financing costs (interest), taxes
- Used for: Full-cost-plus calculations, standard LVAS, benchmarking against Orbis comparables
- **Polish preference:** KAS and tax courts consistently require fully-loaded cost base; direct cost-only approaches are rejected in audits unless expressly agreed in APA

**Direct cost base (limited use):**
- Only direct personnel costs and directly attributable expenses
- Acceptable only where indirect costs are genuinely immaterial (<5% of total costs)
- Risk: understates true cost base, leading to higher effective markup percentage vs. comparables benchmarked on fully-loaded basis

**Pass-through costs:**
- Costs incurred by SSC on behalf of the recipient but with no value added (e.g., reimbursed travel, third-party software licenses bought and recharged at cost)
- Should be **excluded from markup base** and charged at cost only
- Must be documented separately — mixing pass-through and markup base is a common audit finding in Poland

**Polish practice note:** Polish TP regulations (rozporządzenie MF, art. 6) explicitly require that the cost base for cost-plus / TNMM analyses use costs consistent with the accounting records of the service provider, and exclude items not economically connected to the service delivery.

---

## 5. Implications for Analyze Pipeline v2

### 5.1 New Thresholds for Step 5 Scoring

The following modifications to the existing 5-dimension scoring rubric are recommended based on this research:

**Dimension A — Financial Performance (r/r changes):**
- Add sub-score for **EBIT margin vs. entity-type benchmark** (see Section 1.2 table): score 0 if within IQR, +2 if below P25, +4 if negative (for routine entity)
- Add sub-score for **revenue growth vs. margin trajectory**: score +2 if revenue grows >20% r/r while margin compresses >3 pp
- Add sub-score for **consecutive loss years**: +3 per year of operating loss for routine profile entities
- Add flag: **cost ratio shift** — external services / revenue increase >5 pp r/r → +2

**Dimension B — Tax Profile:**
- Primary threshold: ETR **< 15%** for non-SEZ entity → risk score +4 (CRITICAL)
- Secondary threshold: ETR **< 9%** (non-small taxpayer) → additional +3
- ETR **15–18%** → +1 (investigate)
- ETR **> 28%** → +1 (investigate deferred tax)
- SEZ/PIZ status: if entity has SEZ exemption AND is part of EUR 750M+ group → add Pillar Two flag

**Dimension C — Restructuring / Management Report signals:**
- Any business restructuring event from Section 2.1 table detected in sprawozdanie zarządu → +3 per event
- DAC6/MDR disclosure mentioned → +4 (likely already reported)
- New intercompany agreement (first mention or material change) → +2

**Dimension D — Cost Structure (SSC entities):**
- EBIT margin outside 3–12% range → +2
- Personnel costs / revenue outside 40–80% → +2
- External services / revenue increase >10 pp → +3

**Dimension E — Group / Documentation:**
- No benchmarking study for transactions >PLN 2M → automatic HIGH flag per Polish regulations
- TPR-reported margins outside P25–P75 of sector → +3
- CbCR entity (group revenue ≥ EUR 750M) → multiply all risk scores by 1.2

---

### 5.2 Block 4E Search Terms

Terms to search for in the sprawozdanie zarządu / sprawozdanie z działalności (case-insensitive, Polish and English):

**Restructuring / model change:**
```
restrukturyzacja | reorganizacja | centralizacja | zmiana modelu
konwersja | przekształcenie | przeniesienie funkcji | przeniesienie aktywów
transfer of functions | business restructuring | principal structure
commissionnaire | komisant | komisionant
limited risk | ograniczone ryzyko
toll manufacturing | usługi produkcyjne na zlecenie
```

**Intercompany agreements (new or changed):**
```
umowa o zarządzanie | management services agreement | MSA
umowa licencyjna | licencja | know-how | patent
umowa dystrybucyjna | distribution agreement
pożyczka od | loan from | intercompany loan
cash pool | cash pooling | notional pooling
gwarancja | poręczenie | surety | guarantee fee
```

**TP documentation / regulatory:**
```
ceny transferowe | transfer pricing | dokumentacja cen
uprzednie porozumienie cenowe | APA | advance pricing
MDR | DAC6 | mandatory disclosure
korekta cen | TP adjustment | price adjustment
interpretacja indywidualna | tax ruling
kontrola podatkowa | tax audit | postępowanie podatkowe
```

**Group support / dependency signals:**
```
dofinansowanie | subwencja | dotacja od grupy | group subsidy
wsparcie jednostki dominującej | parent support
przychody od podmiotów powiązanych | intercompany revenue
```

---

### 5.3 Block 4F Assessment Rules

**ETR assessment rules for tax risk scoring in pipeline v2:**

```
IF etr IS NULL:
  → flag = "BRAK DANYCH" / score += 1

IF entity has SEZ/PIZ exemption (detected in report or JSON):
  → apply SEZ-adjusted interpretation (see Section 3.2)
  → if group_revenue >= 750M EUR: add Pillar Two flag

IF etr < 0.09 AND NOT small_taxpayer AND NOT SEZ_entity:
  → risk = CRITICAL / score += 5 / label = "ETR poniżej stawki obniżonej — brak uzasadnienia"

IF etr >= 0.09 AND etr < 0.15 AND NOT SEZ_entity:
  → risk = HIGH / score += 3 / label = "ETR poniżej progu Pillar Two — wymaga wyjaśnienia"

IF etr >= 0.15 AND etr < 0.18:
  → risk = MEDIUM / score += 1 / label = "ETR poniżej stawki CIT — zbadaj ulgę B+R / IP Box"

IF etr >= 0.18 AND etr <= 0.20:
  → risk = LOW / score += 0 / label = "ETR zgodny ze stawką CIT 19%"

IF etr > 0.20 AND etr <= 0.28:
  → risk = LOW / score += 0 / label = "Podwyższone ETR — prawdopodobne koszty niededukcyjne"

IF etr > 0.28:
  → risk = MEDIUM / score += 1 / label = "Wysoki ETR — zbadaj korekty TP z poprzednich lat / rezerwy podatkowe"

IF etr < 0 (negative):
  → risk = HIGH / score += 2 / label = "Ujemne ETR — zbadaj duże aktywa z tytułu odroczonego podatku"

IF |etr_current - etr_prior| > 0.05 (>5 pp shift year-on-year):
  → add flag = "ZNACZĄCA ZMIANA ETR r/r" / score += 1
```

**Implied rate assessment (for intercompany loans):**

```
IF implied_rate IS NULL:
  → flag = "BRAK DANYCH — nie zidentyfikowano finansowania wewnątrzgrupowego"

IF implied_rate < 0 OR implied_rate > 0.50:
  → set implied_rate = NULL / add note = "Stopa poza zakresem [0%, 50%] — dane nieporównywalne"

IF implied_rate < 0.02:
  → risk = HIGH / label = "Stopa % poniżej stopy wolnej od ryzyka — zbadaj warunkę rynkowości"

IF implied_rate >= 0.02 AND implied_rate <= 0.08:
  → risk = LOW / label = "Stopa % w typowym przedziale rynkowym"

IF implied_rate > 0.08 AND implied_rate <= 0.15:
  → risk = MEDIUM / label = "Podwyższona stopa % — zbadaj rating grupy i warunki rynkowe"

IF implied_rate > 0.15:
  → risk = HIGH / label = "Wysoka stopa % — potencjalne zawyżenie kosztów finansowych"
```

---

*End of document — prepared by Claude Code for review by TP Radar project director.*
*All thresholds are indicative and based on OECD guidelines and Polish regulatory practice. Final implementation requires validation by a licensed TP professional.*
