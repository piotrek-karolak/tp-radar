# Report Writing Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Executive Summary (section 00) to orange-polska.html and overhaul writing style throughout (Pyramid, Action Titles, active recommendations), then encode the writing guide in CLAUDE.md as Step 7A.

**Architecture:** Two independent files modified sequentially — CLAUDE.md first (source of truth), then orange-polska.html (demonstration). No new CSS classes needed; all changes are content/text edits only.

**Tech Stack:** HTML (edit existing), Markdown (CLAUDE.md edit), plain text editing via Edit tool, browser for visual verification.

**Spec:** `docs/superpowers/specs/2026-03-23-report-writing-style-design.md`

---

## File Map

| File | Change |
|------|--------|
| `CLAUDE.md` | Insert Step 7A block (between Step 6 and Step 7, around line 248) |
| `reports/orange-polska.html` | (A) Insert section 00, (B) rewrite 3 headers, (C) rewrite 8 risk-desc, (D) rewrite 8 risk-rec |

---

## Task 1: Add Step 7A — Writing Style Guide to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — insert between `### Step 6: Compute financial metrics` and `### Step 7: Generate report`

---

- [ ] **Step 1: Read CLAUDE.md lines 238–255 to find exact insertion point**

Run: read `CLAUDE.md` offset 238, limit 20. Find the line `### Step 7: Generate report`.

- [ ] **Step 2: Insert Step 7A block**

Insert the following block immediately before `### Step 7: Generate report`:

```markdown
---

### Step 7A: Writing style — apply before generating the report

**CRITICAL: Before writing any section of the report, internalize these rules. Every section must comply.**

#### Executive Summary template (section 00)

**SCQA paragraph (2–3 sentences):**
```
S: [Spółka] jest [rola w grupie], przychody [X] mln PLN ([rok]).
C: Łączna wartość transakcji z podmiotami powiązanymi wynosi [X] mln PLN
   ([X]% przychodów) — zidentyfikowano [N] kategorii transakcji TP.
A: Ocena ryzyka: [POZIOM] ([N]/10) — [top 2–3 tematy jednym zdaniem].
```

**3 "Tematy wymagające uwagi" cards:**
- Select the 3 transactions with the highest PLN value that have a methodological question or documentation matter
- Format: [KATEGORIA] | [Nazwa transakcji] | [Kwota PLN]
- One sentence: konkretna kwestia metodologiczna lub dokumentacyjna — pisana na poziomie senior TP, bez tłumaczenia pojęć

Category labels: FINANSOWANIE / LICENCJA / JV / USŁUGI / GWARANCJE / INSTRUMENTY / INNE

#### Action Titles — section headers

Headers must be declarative statements, not category labels. Derive from actual data:

| Section | Derive title from | Example |
|---------|-----------------|---------|
| 05 — Transakcje | liczba kategorii + łączna wartość | "05 — Transakcje z grupą: 10 kategorii, łącznie >5 mld PLN" |
| 07 — Ryzyka | liczba HIGH/CRITICAL + co wymagają | "07 — Dwa obszary HIGH wymagają weryfikacji dokumentacji" |
| 08 — Macierz | liczba priorytetów natychmiastowych | "08 — Macierz priorytetów: 3 działania natychmiastowe" |

#### Pyramid rule for risk-desc

**First sentence of every risk-desc = assessment or conclusion, not description.**

❌ Wrong: "Orange Polska finansuje działalność długoterminowymi pożyczkami od Atlas Services Belgium S.A. — spółki zależnej Orange S.A. W 2024 roku przeprowadzono refinansowanie..."
✅ Right: "Portfel pożyczek od Atlas (4 245 mln PLN, 37,7% przychodów) był częściowo refinansowany w 2024 — nowa transza stała wymaga aktualnej dokumentacji TP."

#### Recommendation format

```
Zalecamy [co konkretnie] — [cel/uzasadnienie] — [priorytet czasowy jeśli znany].
```

**Forbidden constructions:**

| Forbidden | Replace with |
|-----------|-------------|
| "Pytanie TP: czy..." | Konkretna obserwacja lub usuń całkowicie |
| "Zweryfikować dokumentację" | "Zalecamy przegląd dokumentacji X pod kątem Y" |
| "należy rozważyć możliwość X" | "Zalecamy X" |
| "warto zweryfikować" | "Zalecamy weryfikację X" |
| "Potwierdzić, że..." | "Zalecamy potwierdzenie X" lub usuń jeśli oczywiste |
| Bezosobowa forma bez podmiotu | Aktywna forma z "Zalecamy" |

#### Quality check before finalizing

Before completing the report, answer:
1. Does section 00 answer "is this an interesting case?" in under 30 seconds?
2. Does every risk-desc open with an assessment, not a transaction description?
3. Are all recommendations active ("Zalecamy..."), specific, and with stated purpose?

If any answer is NO — rewrite the relevant section.

```

Note: the outer code block wraps the entire Step 7A content. When inserting, do NOT include the outer ``` markers — those are just for display in this plan.

- [ ] **Step 3: Verify insertion**

Read `CLAUDE.md` around the insertion point. Confirm:
- Step 7A appears between Step 6 and Step 7
- All 4 subsections present: ES template, Action Titles, Pyramid rule, forbidden list + quality check

- [ ] **Step 4: Commit**

```bash
cd "/Users/piotrkarolak/Claude Code/tp-radar"
git add CLAUDE.md
git commit -m "docs(pipeline): add Step 7A writing style guide

- Executive Summary template (SCQA + 3 topic cards)
- Action Titles rule with examples per section
- Pyramid rule for risk-desc paragraphs
- Forbidden constructions list with replacements
- 3-question quality check before report finalization

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add section 00 — Executive Summary to orange-polska.html

**Files:**
- Modify: `reports/orange-polska.html` line 448 — insert new section before `<!-- 1. KLUCZOWE DANE FINANSOWE -->`

---

- [ ] **Step 1: Read lines 445–455 to confirm insertion point**

Verify line 448 starts the container div and line 451 has the first section-label.

- [ ] **Step 2: Insert section 00 HTML block**

Insert immediately after `<div class="container">` (line 448), before `<!-- 1. KLUCZOWE DANE FINANSOWE -->`:

```html
  <!-- 0. EXECUTIVE SUMMARY -->
  <div class="section-label">00 — Podsumowanie dla analityka</div>

  <div class="info-box" style="margin-bottom: 8px;">
    Orange Polska S.A. jest strategiczną spółką operacyjną Grupy Orange w Polsce (50,67% Orange S.A.), z przychodami 11,3 mld PLN za 2024 rok. Łączna wartość transakcji z podmiotami powiązanymi przekracza 5 mld PLN rocznie (&gt;45% przychodów) — zidentyfikowano 10 kategorii transakcji TP, w tym finansowanie zewnętrzne, licencję marki, instrumenty pochodne IRS, cash pooling oraz transakcje z JV Światłowód Inwestycje. Ocena ryzyka: <strong>HIGH (6/10)</strong> — trzy tematy wymagają weryfikacji dokumentacji: pożyczki od Atlas Services Belgium (4&nbsp;245 mln PLN), opłata licencyjna OBSL (~180 mln PLN) i transakcje ze Światłowód Inwestycje (787 mln PLN).
  </div>

  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px;">

    <div class="risk-card" style="margin: 0;">
      <div class="risk-stripe HIGH"></div>
      <div class="risk-body-inner" style="padding: 16px 18px;">
        <div style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">FINANSOWANIE</div>
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Pożyczki od Atlas Services Belgium S.A.</div>
        <div style="font-family: var(--font-mono); font-size: 12px; color: var(--high); margin-bottom: 8px;">4 245 mln PLN</div>
        <div style="font-size: 12px; color: #4a4540; line-height: 1.5;">Refinansowanie 2024: nowa transza stała (1,205 mld PLN, termin V 2029) — dokumentacja TP dla nowej transzy wymaga aktualizacji benchmarku efektywnej stopy po hedgingu IRS.</div>
      </div>
    </div>

    <div class="risk-card" style="margin: 0;">
      <div class="risk-stripe HIGH"></div>
      <div class="risk-body-inner" style="padding: 16px 18px;">
        <div style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">LICENCJA</div>
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Opłata licencyjna OBSL za markę Orange</div>
        <div style="font-family: var(--font-mono); font-size: 12px; color: var(--high); margin-bottom: 8px;">~180 mln PLN / rok</div>
        <div style="font-size: 12px; color: #4a4540; line-height: 1.5;">Stawka "do 1,6% przychodów operacyjnych" to cap umowny, nie cena — faktyczny poziom roczny i metodologia benchmarku (CUP vs. profit split dla marki telco) wymagają weryfikacji w dokumentacji.</div>
      </div>
    </div>

    <div class="risk-card" style="margin: 0;">
      <div class="risk-stripe MEDIUM"></div>
      <div class="risk-body-inner" style="padding: 16px 18px;">
        <div style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">JV</div>
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Transakcje ze Światłowód Inwestycje (50% JV)</div>
        <div style="font-family: var(--font-mono); font-size: 12px; color: var(--medium); margin-bottom: 8px;">787 mln PLN (przepływy)</div>
        <div style="font-size: 12px; color: #4a4540; line-height: 1.5;">Dwukierunkowe przepływy (584 mln sprzedaż + 203 mln zakup) i pożyczka 174 mln PLN od JV — każdy strumień wymaga odrębnej dokumentacji TP mimo naturalnego market check z APG.</div>
      </div>
    </div>

  </div>
```

- [ ] **Step 3: Verify visually**

Open `reports/orange-polska.html` in a browser (or use `open "reports/orange-polska.html"` in terminal). Confirm:
- Section 00 appears at top of the report before section 01
- SCQA paragraph renders in info-box style
- 3 cards render in a 3-column grid with correct stripe colors (HIGH/HIGH/MEDIUM)
- Text is readable, no overflow

- [ ] **Step 4: Commit**

```bash
cd "/Users/piotrkarolak/Claude Code/tp-radar"
git add reports/orange-polska.html
git commit -m "feat(orange): add section 00 Executive Summary

SCQA paragraph + 3 topic cards (Atlas loans, OBSL license, Światłowód JV).
Hybrid format: narrative + visual cards using existing design system.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite Action Title headers (sections 05, 07, 08)

**Files:**
- Modify: `reports/orange-polska.html` lines 629, 892, 1093 (these line numbers shift by ~60 after Task 2 insertion — re-read before editing)

---

- [ ] **Step 1: Find current section labels using grep**

Run Grep for `section-label` in `reports/orange-polska.html` to get updated line numbers after Task 2.

- [ ] **Step 2: Replace section 05 header**

Old:
```html
<div class="section-label">05 — Transakcje z podmiotami powiązanymi · 2024 vs 2023</div>
```

New:
```html
<div class="section-label">05 — Transakcje z podmiotami powiązanymi: 10 kategorii, łączna wartość &gt;5 mld PLN</div>
```

- [ ] **Step 3: Replace section 07 header**

Old:
```html
<div class="section-label">07 — Analiza zidentyfikowanych ryzyk TP</div>
```

New:
```html
<div class="section-label">07 — Dwa obszary HIGH i sześć MEDIUM wymagają przeglądu dokumentacji</div>
```

- [ ] **Step 4: Replace section 08 header**

Old:
```html
<div class="section-label">08 — Macierz priorytetów ryzyk TP</div>
```

New:
```html
<div class="section-label">08 — Macierz priorytetów: 3 działania natychmiastowe, 5 standardowych</div>
```

- [ ] **Step 5: Verify**

Run Grep for `section-label` in the file. All 3 updated labels should appear with new text.

- [ ] **Step 6: Commit**

```bash
cd "/Users/piotrkarolak/Claude Code/tp-radar"
git add reports/orange-polska.html
git commit -m "feat(orange): Action Titles for sections 05, 07, 08

Declarative headings with data — reader understands scope
by scanning headers alone.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Rewrite risk-desc paragraphs — Pyramid style

**Files:**
- Modify: `reports/orange-polska.html` — all 8 `.risk-desc` paragraphs and their `.risk-bullets` lists

Note: Line numbers have shifted from Tasks 2–3. Use Grep to find each risk card by its `risk-title` content before editing.

---

**Rules for this task:**
1. First sentence of each `<p class="risk-desc">` = assessment/conclusion, not description
2. Remove ALL `<li>` items containing "Pytanie TP:" — replace with factual observations
3. Keep existing supporting evidence bullets where they are already factual findings

---

- [ ] **Step 1: Rewrite risk-desc for RYZYKO 1 (OBSL brand license)**

Find: `<p class="risk-desc">` after `risk-title">Opłata licencyjna za markę Orange — OBSL`

Replace `<p class="risk-desc">...</p>` with:
```html
<p class="risk-desc">
  Opłata licencyjna za markę Orange (~180 mln PLN/rok) jest pobierana przez <strong>OBSL</strong> (Wielka Brytania) według stawki <strong>"do 1,6% przychodów operacyjnych"</strong> — cap umowny, nie cena stała. Faktyczny poziom opłaty w poszczególnych latach nie jest ujawniany w sprawozdaniu finansowym (standard rynkowy), jednak metodologia benchmarkingu i zakres licencji są kluczowe dla oceny arm's length.
</p>
<ul class="risk-bullets">
  <li>Stawka "do 1,6% rev" to cap umowny — rzeczywista opłata może być niższa; mechanizm ustalania ceny powinien być opisany w dokumentacji TP</li>
  <li>Jurysdykcja UK (post-Brexit) — OECD Guidelines i UK TP rules obowiązują; brak reżimu UE nie zmniejsza ryzyka</li>
  <li>Zakres licencji prawdopodobnie obejmuje markę, standardy sieci i know-how grupy — rozgraniczenie od opłat za usługi techniczne jest kluczowe dla benchmarku</li>
  <li>Globalne opłaty brandowe telekomów mieszczą się w przedziale 0,5–2,5% rev — stawka OPL mieści się w zakresie, ale porównywalność zależy od zakresu licencji</li>
</ul>
```

- [ ] **Step 2: Rewrite risk-desc for RYZYKO 2 (Atlas loans)**

Find: `<p class="risk-desc">` after `risk-title">Pożyczki od Atlas Services Belgium S.A.`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Portfel pożyczek od Atlas Services Belgium (4&nbsp;245 mln PLN, 37,7% przychodów) był częściowo refinansowany w 2024 roku — nowa transza stała (<strong>1,205 mld PLN, termin V 2029</strong>) wymaga aktualnej dokumentacji TP. Efektywna stopa po hedgingu IRS wynosi <strong>4,15% p.a.</strong>, co jest poziomem rynkowym; stopa nominalna 6,74% jest istotna wyłącznie przy ocenie transzy zmiennej bez uwzględnienia IRS.
</p>
<ul class="risk-bullets">
  <li>Aktualne transze: 2,703 mld PLN zmienne (VI 2026) + 1,205 mld PLN stałe (V 2029) + RCF 1,0 mld PLN (XI 2027)</li>
  <li>Implied rate kalkulacyjna: <strong>3,79%</strong> — w normie (odsetki 163 mln / średnie saldo)</li>
  <li>Koszty odsetkowe netto 2024: (163) mln PLN do Grupy Orange; ICR: 21,5× — bardzo komfortowy poziom</li>
  <li>Refinansowanie 2024: wygasłą transzę zmienną 1,5 mld PLN zastąpiono nową stałą — zmiana profilu ryzyka stopy procentowej wymaga aktualizacji benchmarku</li>
  <li>Wartość pożyczek = 37,7% przychodów — materialna; pożyczki niezabezpieczone, typowe dla intragroup treasury</li>
</ul>
```

- [ ] **Step 3: Rewrite risk-desc for RYZYKO 3 (Światłowód JV)**

Find: `<p class="risk-desc">` after `risk-title">Transakcje z Światłowód Inwestycje`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Transakcje ze Światłowód Inwestycje (JV 50/50 z niezależnym APG — holenderski fundusz emerytalny) obejmują dwa odrębne strumienie o łącznej wartości <strong>787 mln PLN</strong> oraz zobowiązania 711 mln PLN — to dominująca pozycja przychodów RP spółki. Udział niezależnego inwestora stanowi naturalny mechanizm rynkowy (arm's length check), jednak złożoność transakcji wymaga odrębnej dokumentacji TP dla każdego strumienia.
</p>
<ul class="risk-bullets">
  <li>Sprzedaż do JV: 584 mln PLN (usługi zarządzania procesem inwestycyjnym + sprzedaż aktywów sieci)</li>
  <li>Zakup od JV: 203 mln PLN (dostęp do infrastruktury światłowodowej)</li>
  <li>Zobowiązania 711 mln PLN: głównie przedpłaty za przyszłe usługi — prawidłowość klasyfikacji MSSF 16</li>
  <li>Nowa pożyczka od JV: 174 mln PLN (VIII 2031) — kierunek odwrotny (JV finansuje OPL), wymaga osobnej oceny TP</li>
  <li>Opcja nabycia ~1% do kontroli w 2027–2029: zmiana statusu może zmienić klasyfikację transakcji z "JV" na "subsidiary"</li>
</ul>
```

- [ ] **Step 4: Rewrite risk-desc for RYZYKO 4 (IRS)**

Find: `<p class="risk-desc">` after `risk-title">Instrumenty pochodne IRS z Orange S.A.`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  IRS z Orange S.A. (nominał <strong>2&nbsp;300 mln PLN</strong>, FV <strong>+138 mln PLN</strong>) efektywnie konwertuje zmienne oprocentowanie pożyczek Atlas (6,74%) na stałe <strong>4,15%</strong> — instrument działa zgodnie z celem hedgingowym, FV dodatnia dla OPL. Kwestia TP: warunki swapu powinny być porównywalne z ofertą banków zewnętrznych, ponieważ kontrahent (Orange S.A.) jest podmiotem dominującym, nie niezależnym animatorem rynku.
</p>
<ul class="risk-bullets">
  <li>Nominał zmniejszył się z 3&nbsp;800 mln (2023) do 2&nbsp;300 mln PLN (2024) — zgodnie ze spłatą pożyczki zmiennej</li>
  <li>FV +138 mln PLN to aktywo dla OPL — instrument po stronie "in-the-money" przy obecnych stopach</li>
  <li>Inne całkowite straty z wyceny IRS: (71) mln PLN w 2024 — ujęte w OCI, nie w wyniku</li>
  <li>IRS i pożyczka od Atlas to odrębne umowy z różnymi podmiotami grupy — analiza łączna ("blended rate") jest dopuszczalna w dokumentacji TP</li>
</ul>
```

- [ ] **Step 5: Rewrite risk-desc for RYZYKO 5 (Zakupy od Grupy)**

Find: `<p class="risk-desc">` after `risk-title">Zakupy usług hurtowych i B+R od Grupy Orange`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Zakupy od Grupy Orange (<strong>269 mln PLN</strong>) obejmują trzy kategorie o różnej metodologii TP: usługi hurtowe telco od Orange S.A. bezpośrednio (72 mln PLN), opłata licencyjna OBSL ujęta w pozycji "Grupa Orange excl. Orange S.A." (~180 mln PLN z 197 mln tej pozycji) oraz usługi B+R dwukierunkowe. Roaming wychodzący (55 mln PLN) jest rozliczany przez Orange S.A. jako passthrough według stawek IOT regulowanych przez UE.
</p>
<ul class="risk-bullets">
  <li>Pozycja "Grupa Orange excl. Orange S.A." (197 mln PLN) zawiera w sobie opłatę licencyjną OBSL (~180 mln PLN) — należy je rozdzielić w dokumentacji</li>
  <li>Usługi B+R: OPL jest jednocześnie nabywcą i sprzedawcą usług B+R z Grupą Orange — transakcja dwukierunkowa wymaga spójnej metodologii dla obu kierunków</li>
  <li>Roaming (55 mln PLN passthrough przez Orange S.A.): stawki IOT regulowane przez UE — naturalny CUP dostępny</li>
  <li>Jurysdykcje: Francja (UE) i Wielka Brytania (post-Brexit OECD) — standardowe dla grup europejskich</li>
</ul>
```

- [ ] **Step 6: Rewrite risk-desc for RYZYKO 6 (Sprzedaż do Grupy)**

Find: `<p class="risk-desc">` after `risk-title">Sprzedaż hurtowych usług telekomunikacyjnych do Grupy Orange`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Sprzedaż hurtowych usług telekomunikacyjnych i B+R do Grupy Orange (<strong>262 mln PLN</strong>) jest symetryczna wobec zakupów w tej samej kategorii — OPL jest zarówno dostawcą jak i odbiorcą usług B+R od grupy. Dla połączeń roamingowych przychodzących stawki są częściowo regulowane (IOT rates UE), co zapewnia naturalny CUP.
</p>
<ul class="risk-bullets">
  <li>Sprzedaż do Orange S.A.: 195 mln PLN; do pozostałych podmiotów Grupy: 67 mln PLN</li>
  <li>Transakcja B+R dwukierunkowa: spójność metodologiczna z zakupami B+R (Ryzyko 5) jest kluczowa przy audycie</li>
  <li>Stawki hurtowe dla połączeń przychodzących: częściowo regulowane przez prawo UE (IOT) — CUP dostępny jako metoda</li>
  <li>Sprzedaż hurtowa do Grupy Orange to 27,4% całości sprzedaży do podmiotów powiązanych (262 mln / 957 mln)</li>
</ul>
```

- [ ] **Step 7: Rewrite risk-desc for RYZYKO 7 (Cash pool)**

Find: `<p class="risk-desc">` after `risk-title">Scentralizowane zarządzanie skarbcem — cash pool Orange S.A.`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Depozyty OPL w Orange S.A. (saldo <strong>150 mln PLN</strong> na 31.12.2024, spadek z 649 mln w 2023) przyniosły <strong>17 mln PLN</strong> przychodów finansowych według "stawek rynku pieniężnego". Znaczący odpływ środków z cash pool w 2024 roku (–499 mln PLN) wynika prawdopodobnie z refinansowania i inwestycji kapitałowych — wymaga potwierdzenia w kontekście TP.
</p>
<ul class="risk-bullets">
  <li>Sformułowanie "stawki rynku pieniężnego" bez podania benchmarku (WIBOR/EURIBOR) to typowa luka ujawnieniowa — nie brak oprocentowania</li>
  <li>Implikowana stopa: 17 mln / ~400 mln (średnie saldo) ≈ 4,3% — poziom zbliżony do WIBOR ON w 2024, prima facie rynkowy</li>
  <li>Odpływ 499 mln PLN w 2024: powiązany prawdopodobnie z refinansowaniem pożyczki Atlas (maj 2024) i dokapitalizowaniem Światłowód (169 mln PLN)</li>
  <li>Cash pooling z podmiotem dominującym (nie z bankiem zewnętrznym) — standardowe dla grup telco klasy OPL</li>
</ul>
```

- [ ] **Step 8: Rewrite risk-desc for RYZYKO 8 (Guarantees)**

Find: `<p class="risk-desc">` after `risk-title">Gwarancje udzielone spółkom zależnym bez ujawnionej opłaty`

Replace `<p class="risk-desc">...</p>` and `<ul class="risk-bullets">...</ul>` with:
```html
<p class="risk-desc">
  Gwarancje finansowe dla spółek zależnych (<strong>102 mln PLN</strong>, spadek z 110 mln w 2023) ujawnione bez informacji o wynagrodzeniu. Brak wzmianki o guarantee fee jest typowy dla małych gwarancji wewnątrzgrupowych, lecz wymaga formalnej dokumentacji TP zgodnie z OECD Chapter X — nawet przy decyzji o nieodpłatnym świadczeniu.
</p>
<ul class="risk-bullets">
  <li>OECD Guidelines Ch. X (Financial Transactions, 2022) wymagają dokumentacji dla gwarancji niezależnie od tego, czy fee jest pobierane</li>
  <li>Rynkowy zakres guarantee fee: 0,5–3% p.a. wartości gwarancji → przy 102 mln PLN: 0,5–3 mln PLN rocznie</li>
  <li>Kwota 102 mln PLN relatywnie niska vs. progi dokumentacyjne — ryzyko bezwzględne ograniczone</li>
  <li>Beneficjenci gwarancji: polskie spółki zależne (🇵🇱) — jurysdykcja krajowa, niższe ryzyko zagraniczne</li>
</ul>
```

- [ ] **Step 9: Verify — no "Pytanie TP:" remains**

Run Grep: pattern `Pytanie TP` in `reports/orange-polska.html`. Expected: 0 matches.

- [ ] **Step 10: Commit**

```bash
git add reports/orange-polska.html
git commit -m "feat(orange): Pyramid style in all 8 risk cards

First sentence = assessment. Removed 'Pytanie TP:' constructions.
Replaced with factual observations at senior TP practitioner level.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Rewrite risk-rec recommendations — active directives

**Files:**
- Modify: `reports/orange-polska.html` — all 8 `.risk-rec` divs

---

- [ ] **Step 1: Rewrite risk-rec for RYZYKO 1 (OBSL)**

Find: `<div class="risk-rec">` after the OBSL risk card bullets.

Replace content between `<div class="risk-rec">` and `</div>`:
```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy weryfikację dokumentacji TP dla transakcji z OBSL — kluczowe: (1) metoda benchmarkingu (CUP dla globalnych marek telco lub TNMM), (2) faktyczny poziom opłaty stosowanej w roku (nie tylko cap umowny), (3) rozgraniczenie komponentu marki od know-how i usług sieciowych grupy.
</div>
```

- [ ] **Step 2: Rewrite risk-rec for RYZYKO 2 (Atlas)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy aktualizację dokumentacji TP dla nowej transzy stałej (1,205 mld PLN, 2024) — benchmark stóp procentowych powinien uwzględniać efektywną stopę po hedgingu IRS (4,15%), nie stopę nominalną przed IRS. Priorytet: przed terminem złożenia TPR za rok 2024.
</div>
```

- [ ] **Step 3: Rewrite risk-rec for RYZYKO 3 (Światłowód)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy przygotowanie odrębnej dokumentacji TP dla trzech strumieni transakcji z JV: (1) usługi zarządzania procesem inwestycyjnym (584 mln PLN), (2) dostęp do infrastruktury (203 mln PLN), (3) pożyczka od JV 174 mln PLN. Udział APG stanowi naturalny CUP — należy to formalnie odnotować w dokumentacji jako argument obronny.
</div>
```

- [ ] **Step 4: Rewrite risk-rec dla RYZYKO 4 (IRS)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy udokumentowanie warunków IRS jako osobnej transakcji TP — benchmark: porównanie spreadu swapu z ofertami banków zewnętrznych dla swapu o porównywalnym nominale i tenorze na dzień zawarcia umowy. Analiza "blended rate" (IRS + pożyczka łącznie) jest dopuszczalna jako podejście alternatywne.
</div>
```

- [ ] **Step 5: Rewrite risk-rec dla RYZYKO 5 (Zakupy)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy rozdzielenie dokumentacji TP na trzy kategorie zakupów: (1) usługi B+R — metodologia TNMM lub cost plus z marginem, (2) opłata licencyjna OBSL — wyodrębniona z pozycji "Grupa Orange excl. SA" z benchmarkiem CUP, (3) roaming — CUP na stawkach IOT. Spójność metodologiczna z zakupami B+R (dwukierunkowe) jest kluczowa.
</div>
```

- [ ] **Step 6: Rewrite risk-rec dla RYZYKO 6 (Sprzedaż)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy łączną analizę sprzedaży i zakupów usług B+R z Grupą Orange — spójność metodologiczna obu kierunków jest kluczowa przy ewentualnym audycie. Dla usług regulowanych (roaming IOT) dokumentacja CUP jest standardowa i dostępna.
</div>
```

- [ ] **Step 7: Rewrite risk-rec dla RYZYKO 7 (Cash pool)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy weryfikację oprocentowania depozytów cash pool — "stawki rynku pieniężnego" powinny być zidentyfikowane jako konkretny benchmark (WIBOR/EURIBOR ON) w dokumentacji TP. Zalecamy wyjaśnienie zmiany salda o –499 mln PLN w protokole decyzji skarbowych lub dokumentacji za 2024 rok.
</div>
```

- [ ] **Step 8: Rewrite risk-rec dla RYZYKO 8 (Guarantees)**

```html
<div class="risk-rec">
  <strong>Rekomendacja:</strong> Zalecamy formalną dokumentację TP dla gwarancji zgodnie z OECD Ch. X — ustalenie podstawy zwolnienia z opłaty lub wdrożenie guarantee fee (rynkowy zakres: 0,5–3% p.a.). Priorytet standardowy — kwota istotnie poniżej progów materialności.
</div>
```

- [ ] **Step 9: Verify — no forbidden constructions remain**

Run Grep: pattern `Zweryfikować|warto zweryfikować|należy rozważyć|Potwierdzić, że` in `reports/orange-polska.html`. Expected: 0 matches.

- [ ] **Step 10: Commit and push**

```bash
cd "/Users/piotrkarolak/Claude Code/tp-radar"
git add reports/orange-polska.html
git commit -m "feat(orange): active recommendations in all 8 risk cards

'Zalecamy X — cel — termin' format throughout.
Removed: Zweryfikować / warto zweryfikować / Potwierdzić, że.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Final Verification

After all 5 tasks are complete, verify the full report:

1. Open `reports/orange-polska.html` in browser
2. Section 00 visible at top — SCQA paragraph + 3 cards render correctly
3. Scan section headers only — you should understand the report without reading body text
4. Open any 2 risk cards — first sentence is an assessment, no "Pytanie TP:", recommendation starts with "Zalecamy"
5. Check CLAUDE.md — Step 7A block present between Step 6 and Step 7

Run final grep checks:
```bash
grep -c "Pytanie TP" reports/orange-polska.html        # Expected: 0
grep -c "Zweryfikować" reports/orange-polska.html      # Expected: 0
grep -c "Zalecamy" reports/orange-polska.html          # Expected: ≥8
grep -c "Step 7A" CLAUDE.md                            # Expected: 1
```
