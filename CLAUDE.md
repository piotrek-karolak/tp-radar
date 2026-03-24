# TP Radar — Claude Code

## Trigger

When the user writes `analizuj [nazwa spółki]` or `analyze [company name]` — invoke the `/analyze` skill immediately. Do not ask for confirmation.

---

## Project root

`/Users/piotrkarolak/Claude Code/tp-radar/`

---

## Available tools

| Tool | When to use |
|------|-------------|
| `pdf-tools` MCP | Reading PDFs from e-KRS — preferred over Read tool |
| `excel` MCP | Generating .xlsx exports |
| `mermaid` MCP | Group structure diagrams (section 04) |
| `docs` MCP | Reading XHTML/XML/DOCX |
| `fetch` MCP | Fetching IR websites / KRS pages as plain text |
| `memory` MCP | Store company facts between sessions |
| `sequentialthinking` MCP | Complex multi-step analysis |
| `sqlite` MCP | Query tp-radar.db |
| `context7` MCP | Current JS/HTML/CSS docs when writing/debugging HTML |
| `/analyze` | **Full TP analysis pipeline** — use when `analizuj` triggered |
| `/commit` | Commit + push after analysis |
| `/pdf` `/xlsx` `/pptx` `/docx` | Office file skills |

---

## Conventions

- Report content: **Polish** · Code/comments/filenames: **English**
- Company ID: lowercase slug, no legal suffixes (`wb-electronics`, `asseco-poland`)
- `analyzed_at`: ISO date `YYYY-MM-DD`
- Amounts in JSON: **integers in PLN** (not thousands/millions)
- Null fields: `null` — frontend renders "—"
- Numeric formats: `ebit_margin` = % (e.g. 21.7) · `equity_ratio` = decimal (e.g. 0.65) · `debt_ebitda` = ratio (e.g. 4.2) · `implied_rate` = % (e.g. 8.5)

---

## Error handling

| Situation | Action |
|-----------|--------|
| KRS not found | Ask user for KRS manually |
| e-KRS unavailable (2 attempts) | Try company IR website; if also fails — inform user |
| PDF missing sections | Continue with "dane częściowe" annotation |
| Implied rate >50% or <0% | Set `null`, add note in report |
| git push fails | Leave local files intact, inform user |
| Company already in companies.json | Ask: "Spółka już istnieje (analiza z [date]). Zaktualizować?" |
| Extraction template partially blank | Do NOT proceed — search harder or flag "brak informacji" |
