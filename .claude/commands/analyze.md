# TP Radar — Analiza spółki

Pełny pipeline analizy ryzyk Transfer Pricing. Argument: nazwa spółki.

**Zacznij natychmiast. Nie pytaj o potwierdzenie przed startem.**

---

## Step 1: Company ID (slug)

Lowercase, spacje → myślniki, usuń sufiksy prawne (S.A., Sp. z o.o., S.K.A., S.K., sp. j., sp. k.).

- "WB Electronics S.A." → `wb-electronics`
- "Asseco Poland S.A." → `asseco-poland`

---

## Step 2: KRS lookup

WebSearch: `[nazwa spółki] KRS numer spółka`

Wyciągnij 10-cyfrowy numer KRS (format: 0000XXXXXX).
Jeśli nie znaleziono → zapytaj użytkownika.

---

## Step 3: Pobierz dokumenty z e-KRS

URL: `https://rdf-przegladarka.ms.gov.pl/wyszukaj-podmiot`

Playwright MCP:
1. Wyszukaj po numerze KRS
2. Wybierz najnowszy rok
3. Pobierz wszystkie dokumenty:
   - `sprawozdanie.xml` / `.xhtml` — dane finansowe (iXBRL)
   - `informacja_dodatkowa.pdf` — noty (transakcje z powiązanymi)
   - `sprawozdanie_zarzadu.pdf` — sprawozdanie zarządu

Zapisz do `/tmp/tp-radar-[company-id]/`.
Czytaj PDF przez **`pdf-tools` MCP** (lepsza ekstrakcja tabel). Fallback: Read tool z `pages`.

---

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
Przychody netto:                  ___ PLN
EBIT:                             ___ PLN
Zysk brutto (przed podatkiem):    ___ PLN
Podatek dochodowy (bieżący):      ___ PLN
Zysk netto:                       ___ PLN
Aktywa razem:                     ___ PLN
Kapitał własny:                   ___ PLN
EBITDA:                           ___ PLN
Amortyzacja:                      ___ PLN

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

---

## Step 5: Ocena ryzyka TP

5 wymiarów (per transakcja): typ · jurysdykcja · profil finansowy · wolumen · dokumentacja.
Ryzyko transakcji = najwyższy poziom z 5 wymiarów.

Scoring spółki:
- Krok A: CRITICAL×3 + HIGH×2 + MEDIUM×1, cap 10 → (≤2 LOW · 3–5 MEDIUM · 6–8 HIGH · 9–10 CRITICAL)
- Krok B: red flags correction
- Krok C: mitigating factors
- Krok D: contextual override

Pełny rubric: `/Users/piotrkarolak/Claude Code/claude-code-guide/docs/superpowers/specs/2026-03-23-tp-radar-design.md`

Implied rate: `koszty_odsetkowe_RP / ((saldo_długu_RP_t + saldo_długu_RP_t-1) / 2)` — null jeśli wynik >50% lub <0%.

---

## Step 6: Oblicz wskaźniki finansowe i delty r/r

### 6A. Wskaźniki bieżące

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

---

## Step 7: Styl tekstowy — internalizuj przed pisaniem

### Sekcja 00 — jeden akapit, nie szablonowe etykiety

Napisz **jeden ciągły akapit** (nie S:/C:/A: etykiety):

> [Spółka] jest [rola], z przychodami [X] mln PLN za [rok]. Łączna wartość transakcji z podmiotami powiązanymi wynosi [X] mln PLN ([N] kategorie). Ocena ryzyka: **[POZIOM] ([N]/10)** — [2–3 tematy jednym zdaniem].

### Reguła piramidy dla risk-desc

Pierwsze zdanie = ocena/wniosek, NIE opis transakcji.

❌ "Orange Polska finansuje działalność pożyczkami od Atlas..."
✅ "Portfel pożyczek od Atlas (4 245 mln PLN) był refinansowany w 2024 — dokumentacja TP wymaga aktualizacji."

### Format rekomendacji

```
<strong>Rekomendacja:</strong> Zalecamy [co konkretnie] — [cel] — [priorytet].
```

**Zakazane:** "warto zweryfikować" / "należy rozważyć" / "Pytanie TP: czy..." / forma bezosobowa bez "Zalecamy"

### Nagłówki sekcji — asertywne, z danymi

| Sekcja | Przykład |
|--------|---------|
| 05 | "05 — Transakcje z grupą: 10 kategorii, łącznie >5 mld PLN" |
| 07 | "07 — Dwa obszary HIGH wymagają weryfikacji dokumentacji" |
| 08 | "08 — Macierz priorytetów: 3 działania natychmiastowe" |

---

## Step 8: Generuj raport HTML

### PRZED PISANIEM: przeczytaj wzorzec

```
Przeczytaj reports/orange-polska.html linie 32–75 (sekcja 00)
i linie 820–840 (sekcja 09). Skopiuj strukturę HTML, zamień treść.
Nie wymyślaj nazw klas ani układu.
```

### Struktura pliku

```html
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Nazwa] — Analiza TP [rok]</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>

<div class="topbar">
  <a href="../index.html" class="topbar-back">← powrót do dashboardu</a>
  <div class="topbar-logo topbar-logo--right">TP Radar</div>
</div>

<div class="report-header">
  <div class="report-header-inner">
    <div class="report-eyebrow">Analiza ryzyk Transfer Pricing · [standard] [rok]</div>
    <h1 class="report-title">[Nazwa spółki]</h1>
    <p class="report-subtitle">[jedno zdanie opisu]</p>
    <div class="header-chips">
      <span class="header-chip">KRS [nr]</span>
      <span class="header-chip">[Miasto]</span>
      <span class="header-chip">[Podmiot dominujący] 🇩🇪</span>
      <span class="header-chip">[MSSF / PSR]</span>
      <span class="header-chip">Analiza: [YYYY-MM-DD]</span>
      <span class="header-chip risk-chip [HIGH/CRITICAL/MEDIUM/LOW]">● [POZIOM] · [N]/10</span>
    </div>
  </div>
</div>

<div class="container">
  [sekcje 00–09]
</div>

<footer>
  [Nazwa spółki] · KRS [nr] · Analiza TP [rok] · TP Radar · e-KRS/RDF · Claude Code · [data]
</footer>

</body>
</html>
```

### Sekcja 00 — dokładna struktura HTML

```html
<div class="section-label">00 — Podsumowanie dla analityka</div>

<div class="info-box" style="margin-bottom: 8px;">
  [Jeden ciągły akapit: spółka, łączna TP, ocena HIGH X/10, top 2-3 tematy]
</div>

<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px;">
  <div class="risk-card" style="margin: 0;">
    <div class="risk-stripe HIGH"></div>
    <div class="risk-body-inner" style="padding: 16px 18px;">
      <div style="font-size: 10px; letter-spacing: 2px; color: var(--text-3); text-transform: uppercase; margin-bottom: 6px;">KATEGORIA</div>
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Tytuł transakcji</div>
      <div style="font-size: 12px; color: var(--high); margin-bottom: 8px;">Kwota PLN</div>
      <div style="font-size: 12px; color: #4a4540; line-height: 1.5;">Konkretna kwestia metodologiczna lub dokumentacyjna.</div>
    </div>
  </div>
  <!-- powtórz dla kart 2 i 3, zmień HIGH/MEDIUM i var(--high/--medium) -->
</div>
```

### Sekcja 07 — dokładna struktura risk-card

```html
<div class="risk-card">
  <div class="risk-stripe HIGH"></div>          <!-- HIGH/MEDIUM/LOW/CRITICAL -->
  <div class="risk-body-inner">                 <!-- NIE risk-body -->
    <div class="risk-title-row">                <!-- NIE risk-header -->
      <span class="badge HIGH">HIGH</span>
      <span class="risk-title">Nazwa transakcji</span>
      <span class="risk-amt">Kwota PLN · X% przychodów</span>
    </div>
    <p class="risk-desc">Ocena/wniosek w pierwszym zdaniu — nie opis transakcji.</p>
    <ul class="risk-bullets">
      <li>Punkt 1</li>
    </ul>
    <div class="risk-rec">
      <strong>Rekomendacja:</strong> Zalecamy [konkretne działanie] — [cel] — [priorytet].
    </div>
  </div>
</div>
```

### Sekcja 09 — dokładna struktura method-box

```html
<div class="section-label">09 — Uzasadnienie oceny i metodologia</div>

<div class="method-box">
  <strong>Wynik końcowy: [HIGH/CRITICAL] · [N]/10</strong><br><br>
  <strong>Krok A (scoring bazowy):</strong> [N] transakcji HIGH × 2 = [X] pkt; [N] MEDIUM × 1 = [X] pkt. Suma: [N] → base [POZIOM].<br>
  <strong>Krok B (red flags [+N]):</strong> [flaga 1] → +1; [flaga 2] → +1. Wynik po korekcie: [N]/10.<br>
  <strong>Krok C (mitigating [korektaN]):</strong> [czynnik 1]. [czynnik 2]. [Korekta / brak korekty].<br>
  <strong>Krok D (override):</strong> [Brak override / uzasadnienie].<br><br>
  <strong>Źródło danych:</strong> [plik.xml] (e-KRS, ID: [nr]) · [plik.pdf] ([N] stron, nota [N]) · Pobrane: [data].<br>
  <strong>Ograniczenia:</strong> Analiza oparta wyłącznie na sprawozdaniach publicznych. Brak dostępu do dokumentacji TP ani umów grupowych. Wynik ma charakter wskaźnikowy i nie stanowi porady podatkowej.<br>
  <strong>Wygenerowane przez:</strong> Claude Code (Anthropic) · TP Radar Pipeline · [data]
</div>
```

**ZAKAZ w `.method-box`:** `<h3>`, `<p>`, `<ul>`, `<li>` — tylko `<strong>` i `<br>`.

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

### Sekcja 01 — tabela r/r (po .kpi-grid)

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
    <!-- Kontynuuj: EBIT, Marża EBIT (pp), Zysk netto, EBITDA -->
    <tr class="yoy-separator"><td colspan="4">Struktura kosztów</td></tr>
    <!-- Koszty pracownicze, Usługi obce, Amortyzacja -->
    <tr class="yoy-separator"><td colspan="4">Transakcje z podmiotami powiązanymi</td></tr>
    <!-- Przychody TP, Zakupy TP, główne salda finansowe TP jeśli istnieją -->
  </tbody>
</table>
```

**Klasy delta — reguła przypisania:**
- `delta-pos` (zielony): poprawa — wyższe przychody, wyższa marża, niższa koncentracja TP
- `delta-neg` (czerwony): delta < −30% lub > +200% na transakcjach TP lub kosztach (anomalia)
- `delta-warn` (pomarańczowy): |delta| ≥ 20% na transakcjach TP lub kosztach pracowniczych; odchylenie marży > 2pp
- `delta-neutral` (szary): zmiana < 20% bez TP-istotności

**Pomiń tabelę r/r jeśli `financials_prev = null`:** zamiast niej wstaw:
```html
<div class="info-box">Dane porównawcze niedostępne — spółka w pierwszym roku działalności lub brak danych za rok poprzedni.</div>
```

### Sekcja 03 — blok podatkowy (po .metrics-row)

```html
<div class="tax-row">
  <div class="tax-metric">
    <div class="tv [high/warn/ok/neutral]">[X% lub —]</div>
    <div class="tk">ETR (efektywna stopa podatkowa)</div>
    <div class="tt">Podatek [X tys.] PLN / zysk brutto [X mln] PLN · Ustawowa: 19%</div>
  </div>
  <div class="tax-metric">
    <div class="tv [high/warn/ok/neutral]">[±X,Xpp lub —]</div>
    <div class="tk">Odchylenie ETR od stawki ustawowej</div>
    <div class="tt">[Wyjaśnienie: ulga R&D / SSE / straty z lat ubiegłych / brak odchylenia]</div>
  </div>
  <div class="tax-metric">
    <div class="tv [high/warn/ok/neutral]">[±X,X mln PLN lub —]</div>
    <div class="tk">Podatek odroczony netto</div>
    <div class="tt">[Aktywo/Zobowiązanie — interpretacja ryzyka]</div>
  </div>
</div>
```

**Klasy wartości `tv`:**
- `high`: ETR <10% lub >35%; duże zobowiązanie odroczone netto (>10% zysku brutto)
- `warn`: ETR 10–14% lub 26–35%; odchylenie >5pp
- `ok`: ETR 15–25% (zakres normalny)
- `neutral`: dane niedostępne, ETR null, lub zakres graniczny 25–26%

Jeśli `tax.etr = null`: pokaż "—" z adnotacją wyjaśniającą brak danych.

### Sekcja 10 — Kontekst biznesowy (sprawozdanie zarządu)

**Warunek renderowania:**
- `mgmt_report.read = true` → pełna sekcja 10
- `mgmt_report.read = false` → tylko info-box z adnotacją
- Blok 4E < 50% wypełniony → info-box "Sprawozdanie zarządu — dane częściowe"

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
    <div class="mgmt-card-body">[Zmiany podmiotowe, nowe spółki, likwidacje — lub: Brak zmian strukturalnych w roku [T].]</div>
  </div>
</div>

<ul class="rf-list">
  <li class="rf-item">
    <span class="rf-badge HIGH">HIGH</span>
    <span>[Opis red flaga TP ze sprawozdania — konkretne zdarzenie, nie ogólnik]</span>
  </li>
  <!-- powtórz per red flag -->
</ul>
```

**Jeśli brak red flagów ze sprawozdania:** zamiast `rf-list`:
```html
<p style="color: var(--text-3); font-size: 13px; margin-top: 8px;">Brak red flagów TP zidentyfikowanych w sprawozdaniu zarządu.</p>
```

---

## Step 9: Walidacja HTML — OBOWIĄZKOWA przed commitem

```python
import re
with open('reports/[id].html', encoding='utf-8') as f:
    h = f.read()

errors = []
opens, closes = h.count('<div'), h.count('</div>')
if opens - closes != 0:
    errors.append(f"DIV IMBALANCE: {opens} open, {closes} close (diff={opens-closes})")
mb = h[h.find('method-box'):]
if '<h3>' in mb[:2000]: errors.append("<h3> inside .method-box — use <strong> instead")
if 'class="risk-body"' in h: errors.append('risk-body used — should be risk-body-inner')
if 'class="risk-header"' in h: errors.append('risk-header used — should be risk-title-row')
if '<div class="risk-desc">' in h: errors.append('<div class="risk-desc"> — should be <p class="risk-desc">')
if '<footer>' not in h: errors.append('missing <footer>')
rec_count = h.count('class="risk-rec"')
prefix_count = h.count('<strong>Rekomendacja:')
if prefix_count < rec_count: errors.append(f'only {prefix_count}/{rec_count} risk-rec have Rekomendacja: prefix')
inline_styles = re.findall(r'(?<!section 00)<[^>]+ style="(?!display: grid|margin: 0|padding:|font-|letter-spacing|font-weight|color)[^"]*"', h)
if inline_styles: errors.append(f'unexpected inline styles: {inline_styles[:3]}')

if errors:
    print("ERRORS — napraw przed commitem:")
    for e in errors: print(f"  ✗ {e}")
else:
    print("OK — wszystkie sprawdzenia przeszły. Możesz commitować.")
```

---

## Step 10: Zaktualizuj companies.json

Dodaj wpis do tablicy `companies`. Nigdy nie nadpisuj istniejących wpisów.

Pola `financials`: revenue, operating_profit, ebit_margin, net_profit, total_assets, equity, ebitda, equity_ratio, debt_ebitda, icr, implied_rate — wszystkie `number | null`.

Pola `related_party_flows.operational`: purchases, purchases_pct_revenue, sales, sales_pct_revenue, brand_license_entity, brand_license_rate_max_pct.

Pola `related_party_flows.financial`: loans_received_from_rp, loans_granted, interest_costs_to_rp, guarantees_issued, guarantees_received, dividends_received, interest_income, irs_notional, treasury_pool_deposits, financial_income_from_rp.

Waliduj po zapisie:
```bash
python3 -c "import json; d=json.load(open('companies.json')); print(f'OK — {len(d[\"companies\"])} spółek')"
```

---

## Step 11: Deploy — ZAWSZE PYTAJ NAJPIERW

Pokaż użytkownikowi:

```
Gotowe — analiza zakończona dla [Nazwa spółki].

Pliki do zatwierdzenia:
  reports/[id].html   (nowy)
  companies.json      (zaktualizowany, teraz N spółek)

Czy zatwierdzić i opublikować na GitHub Pages?
```

Po potwierdzeniu — użyj `/commit` skill. Fallback: `git add reports/[id].html companies.json && git commit -m "analysis: add [name] TP report" && git push`

GitHub Pages odbudowuje się automatycznie (~30 sek po push).
