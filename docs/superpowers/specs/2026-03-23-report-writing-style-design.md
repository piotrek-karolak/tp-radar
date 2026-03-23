# TP Radar — Report Writing Style Design

**Goal:** Improve readability and professional quality of TP risk reports by adding an Executive Summary section and overhauling the writing style throughout.

**Audience:** Internal — TP team at PwC Poland (senior practitioners, not external clients).

**Reading priority:** b → a → c: Is this an interesting case? → Where's the fire? → What to say at a meeting.

**Architecture:** Two changes in parallel — (1) new section 00 in HTML reports, (2) new Step 7A writing guide in CLAUDE.md pipeline.

**Reference frameworks:** Pyramid Principle (Minto/McKinsey), SCQA, Action Titles, "So What?" test.

---

## Part 1: New Section 00 — Executive Summary

### Position
First section in every report, before `01 — Kluczowe dane finansowe`. Label: `00 — Podsumowanie dla analityka`.

### Structure: Hybrid (prose + cards)

**Block A — SCQA paragraph (2–3 sentences)**

Template:
```
S: [Company] jest [rola w grupie], przychody [X] mln PLN ([rok]).
C: Łączna wartość transakcji z podmiotami powiązanymi wynosi [X] mln PLN
   ([X]% przychodów) — zidentyfikowano [N] kategorii transakcji TP.
A: Ocena ryzyka: [POZIOM] ([N]/10) — [top 2–3 tematy jednym zdaniem].
```

Rules:
- Written in Polish, 2–3 sentences maximum
- Answer (ocena ryzyka) is always the last sentence
- No hedging in the Answer — state the conclusion directly

**Block B — 3 "Tematy wymagające uwagi" cards**

Each card contains:
- Category label (e.g. FINANSOWANIE, LICENCJA, JV, GWARANCJE, USŁUGI)
- Transaction name
- Amount (PLN)
- One sentence: specific methodological question or documentation matter — written at senior TP practitioner level, no explanations of basic concepts

These are NOT risk cards. They flag topics that deserve attention during client engagement or documentation review — regardless of formal risk level.

Selection rule: choose the 3 transactions with the highest PLN value among those that have a methodological question or documentation matter worth raising. This ensures deterministic, reproducible selection.

CSS: reuse existing card design system (no new classes needed).

---

## Part 2: Writing Style Changes

### A — Action Titles in Section Headers

Section headings must be declarative statements, not category labels.

| Section | Principle | Example |
|---------|-----------|---------|
| 05 — Transakcje | Quantify the scope | "05 — Transakcje z grupą: 10 kategorii, łącznie >5 mld PLN" |
| 07 — Ryzyka | State the conclusion | "07 — Dwa obszary HIGH wymagają weryfikacji dokumentacji" |
| 08 — Macierz | State the action | "08 — Plan działań: 3 priorytety natychmiastowe" |

Reader should understand the report by scanning headings alone.

### B — Pyramid Structure in Risk Cards (section 07)

Every `risk-desc` paragraph must open with a conclusion or assessment, not a description.

**Before (descriptive):**
> "Orange Polska finansuje działalność długoterminowymi pożyczkami od Atlas Services Belgium S.A. (Belgia) — spółki zależnej Orange S.A. W 2024 roku przeprowadzono refinansowanie..."

**After (Pyramid):**
> "Portfel pożyczek od Atlas (4 245 mln PLN, 37,7% przychodów) był częściowo refinansowany w 2024 — nowa transza stała wymaga aktualnej dokumentacji TP. Stopa nominalna 6,74% jest istotna, jednak efektywna stopa po hedgingu IRS wynosi 4,15%, co mieści się w normie rynkowej."

Rule: sentence 1 = assessment. Sentences 2–N = supporting evidence.

### C — Active, Specific Recommendations

**Forbidden constructions:**

| Forbidden | Replace with |
|-----------|-------------|
| "Pytanie TP: czy..." | Konkretna obserwacja lub usuń całkowicie |
| "należy rozważyć możliwość X" | "Zalecamy X" |
| "Zweryfikować dokumentację" | "Zalecamy przegląd dokumentacji X pod kątem Y przed terminem Z" |
| Bezosobowe opisy bez podmiotu | Aktywna forma z "Zalecamy" |

**Required recommendation format:**
```
Zalecamy [co konkretnie] — [cel/uzasadnienie] — [priorytet czasowy jeśli znany].
```

---

## Part 3: CLAUDE.md Changes

### New block: Step 7A — Writing Style Guide

Added between Step 6 (financial metrics) and Step 7 (generate report). Contains:

1. **Executive Summary template** (SCQA + 3 topic cards)
2. **Action Title examples** — one per report section, showing how to derive the title from actual data
3. **Forbidden/required constructions** list (from Part 2C above)
4. **Pyramid rule** for risk-desc paragraphs
5. **Quality check** — 3 questions before finalizing the report:
   - Does section 00 answer "is this interesting?" in under 30 seconds?
   - Does every risk-desc open with a conclusion, not a description?
   - Are all recommendations active and specific?

---

## Implementation Scope

### Files to modify:
1. `reports/orange-polska.html` — add section 00, rewrite section headers 05/07/08, rewrite all 8 risk-desc paragraphs and recommendations
2. `CLAUDE.md` — add Step 7A block with full writing guide

### Files NOT modified:
- `assets/style.css` — no new CSS classes needed
- `reports/wb-electronics.html` — updated in next analysis cycle, not now
- `companies.json` — no changes

### Out of scope:
- Changing the visual design system (CSS)
- Modifying the data extraction pipeline (Steps 1–6)
- Regenerating wb-electronics.html (separate task)

---

## Acceptance Criteria

- Section 00 appears in orange-polska.html before section 01
- SCQA paragraph is 2–3 sentences, ends with risk assessment
- 3 topic cards present, each with category + name + amount + one expert-level sentence
- All section 05/07/08 headers are Action Titles (declarative statements with numbers)
- No "Pytanie TP:" bullets in any risk card
- No bezosobowe "Zweryfikować..." recommendations — all replaced with "Zalecamy..."
- Every risk-desc opens with assessment, not transaction description
- Step 7A block present in CLAUDE.md with ES template, forbidden list, quality check
