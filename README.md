# TP Radar

Automated Transfer Pricing risk analysis dashboard for Polish companies.

Built with Claude Code — each analysis is triggered by typing `analizuj [company name]` in Claude Code.

## How to add a company

In Claude Code (inside this project):
```
analizuj [nazwa spółki]
```

Claude Code will fetch financial statements from e-KRS, extract data, assess TP risks, and publish results automatically (~5 minutes per company).

## Stack
- Frontend: Pure HTML + CSS + Vanilla JS
- Data: companies.json (flat file)
- Hosting: GitHub Pages
- Pipeline: Claude Code
