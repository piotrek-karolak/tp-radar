# TP Radar v2 — Report Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the report generation pipeline (Writer → Validator → Reviewer → Reviser) that transforms extracted data + scoring into a professional 11-section Markdown report with three layers of risk identification.

**Architecture:** New `ReportGenerator` service with four phases: Writer (Sonnet, tool use) generates 11 sections + flags additional risks; Validator (Python) checks amounts/completeness; Reviewer (Opus, plain text) does QA + enrichment; Reviser (Sonnet, tool use) applies corrections. Integrates into existing pipeline after scoring phase.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy async, Anthropic SDK, pytest-asyncio

**Spec reference:** `docs/superpowers/specs/2026-04-03-report-generation-design.md` (in tp-radar repo)

**Repo:** `/Users/piotrkarolak/Claude Code/tp-radar-v2/`

---

## File Structure

```
tp-radar-v2/backend/
├── app/
│   ├── services/
│   │   ├── claude_client.py          # MODIFY — add run_simple() method
│   │   └── report_generator.py       # NEW — Writer + Validator + Reviewer + Reviser + Persist
│   └── services/pipeline.py          # MODIFY — add WRITING phase after scoring
├── tests/
│   ├── test_report_generator.py      # NEW — unit tests for all report generation components
│   └── test_pipeline.py              # MODIFY — update integration test for full pipeline
```

---

### Task 1: Add `run_simple()` to ClaudeClient

**Files:**
- Modify: `backend/app/services/claude_client.py:53-112`
- Test: `backend/tests/test_claude_client.py`

The Reviewer (Opus) needs a non-tool-use call that returns plain text. The existing `run_with_tools()` is built around tool loops. We need a simpler method.

- [ ] **Step 1: Write the failing test**

In `backend/tests/test_claude_client.py`, add:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.claude_client import ClaudeClient, SimpleResult


@pytest.mark.anyio
async def test_run_simple_returns_text():
    mock_anthropic = AsyncMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="text", text="Review feedback here.")]
    mock_response.usage = MagicMock(input_tokens=500, output_tokens=200)
    mock_response.stop_reason = "end_turn"
    mock_anthropic.messages.create = AsyncMock(return_value=mock_response)

    client = ClaudeClient(anthropic_client=mock_anthropic, model="claude-opus-4-6")
    result = await client.run_simple(
        system_prompt="You are a reviewer.",
        user_message="Review this report.",
    )

    assert isinstance(result, SimpleResult)
    assert result.text == "Review feedback here."
    assert result.total_input_tokens == 500
    assert result.total_output_tokens == 200
    assert result.cost_usd > 0


@pytest.mark.anyio
async def test_run_simple_uses_correct_model():
    mock_anthropic = AsyncMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="text", text="OK")]
    mock_response.usage = MagicMock(input_tokens=100, output_tokens=50)
    mock_response.stop_reason = "end_turn"
    mock_anthropic.messages.create = AsyncMock(return_value=mock_response)

    client = ClaudeClient(anthropic_client=mock_anthropic, model="claude-opus-4-6")
    await client.run_simple(
        system_prompt="Test",
        user_message="Test",
    )

    call_kwargs = mock_anthropic.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-6"
    assert "tools" not in call_kwargs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_claude_client.py -v -k "run_simple"`
Expected: FAIL — `ImportError: cannot import name 'SimpleResult'`

- [ ] **Step 3: Implement `SimpleResult` and `run_simple()`**

In `backend/app/services/claude_client.py`, add after the `RunResult` class:

```python
@dataclass
class SimpleResult:
    text: str
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    @property
    def cost_usd(self) -> float:
        return (
            self.total_input_tokens * INPUT_PRICE_PER_M / 1_000_000
            + self.total_output_tokens * OUTPUT_PRICE_PER_M / 1_000_000
        )
```

Add to the `ClaudeClient` class, after `run_with_tools()`:

```python
    async def run_simple(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 8192,
        temperature: float = 0.0,
    ) -> SimpleResult:
        """Run Claude without tools — returns plain text response."""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        return SimpleResult(
            text=text,
            total_input_tokens=response.usage.input_tokens,
            total_output_tokens=response.usage.output_tokens,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_claude_client.py -v -k "run_simple"`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/claude_client.py backend/tests/test_claude_client.py
git commit -m "feat: add run_simple() to ClaudeClient for non-tool-use calls"
```

---

### Task 2: Writer — tool definitions, state, and handler

**Files:**
- Create: `backend/app/services/report_generator.py`
- Test: `backend/tests/test_report_generator.py`

This task creates the Writer's tool definitions, `ReportState` dataclass, tool handler, and prompt builder. No Claude calls yet — just the data layer.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_report_generator.py`:

```python
import pytest

from app.services.report_generator import (
    WRITER_TOOLS,
    SECTION_ORDER,
    ReportState,
    handle_writer_tool,
    build_writer_prompt,
)
from app.services.claude_client import ToolResult


def test_writer_tools_defined():
    tool_names = [t.name for t in WRITER_TOOLS]
    assert "write_report_sections" in tool_names
    assert "flag_additional_risk" in tool_names
    assert len(tool_names) == 2


def test_section_order_has_11_keys():
    assert len(SECTION_ORDER) == 11
    assert list(SECTION_ORDER.keys())[0] == "executive"
    assert list(SECTION_ORDER.keys())[-1] == "management_context"


@pytest.mark.anyio
async def test_handle_write_report_sections():
    state = ReportState()
    sections_input = {
        "sections": {
            key: {"summary_md": f"Summary {key}", "full_md": f"# Full {key}"}
            for key in SECTION_ORDER
        }
    }
    result = await handle_writer_tool(state, "write_report_sections", sections_input)
    assert not result.is_error
    assert len(state.sections) == 11
    assert state.sections["executive"]["summary_md"] == "Summary executive"


@pytest.mark.anyio
async def test_handle_write_report_sections_partial():
    state = ReportState()
    sections_input = {
        "sections": {
            "executive": {"summary_md": "Sum", "full_md": "# Full"},
        }
    }
    result = await handle_writer_tool(state, "write_report_sections", sections_input)
    assert not result.is_error
    assert len(state.sections) == 1


@pytest.mark.anyio
async def test_handle_flag_additional_risk():
    state = ReportState()
    risk_input = {
        "name": "Treaty shopping via NL holdingu",
        "category": "tp",
        "level": "MEDIUM",
        "type": "risk",
        "description": "Struktura z holenderskim holdingiem...",
        "amount_pln": None,
        "reasoning_md": "### Analiza\nSzczegoly...",
    }
    result = await handle_writer_tool(state, "flag_additional_risk", risk_input)
    assert not result.is_error
    assert len(state.additional_risks) == 1
    assert state.additional_risks[0]["name"] == "Treaty shopping via NL holdingu"


@pytest.mark.anyio
async def test_handle_flag_additional_opportunity():
    state = ReportState()
    opp_input = {
        "name": "APA candidate",
        "category": "tp",
        "level": "MEDIUM",
        "type": "opportunity",
        "description": "Transakcja kwalifikuje sie do APA...",
        "amount_pln": 50000000,
        "reasoning_md": None,
    }
    result = await handle_writer_tool(state, "flag_additional_risk", opp_input)
    assert not result.is_error
    assert len(state.additional_opportunities) == 1


def test_build_writer_prompt():
    prompt = build_writer_prompt(
        company_name="HAVI Service Hub Sp. z o.o.",
        krs="0000578111",
        financial_year=2024,
        financials={"revenue": 73499477, "net_profit": 3142441},
        financials_prev={"revenue": 68000000},
        cost_structure={"personnel_costs": 5000000},
        tp_transactions=[{"entity": "HAVI DE", "amount_pln": 11000000, "type": "services", "direction": "inbound"}],
        tax_profile={"etr": 12.5},
        mgmt_report={"tp_policy_mentioned": True},
        insights=[{"category": "tp", "observation": "High intercompany ratio"}],
        scoring_data={
            "overall_score": 8,
            "overall_level": "HIGH",
            "category_scores": {"tp": 8},
            "risks": [{"name": "Cash pooling", "level": "HIGH"}],
            "opportunities": [],
        },
        data_gaps=[{"field": "ebitda", "reason": "Not disclosed"}],
    )
    assert "HAVI Service Hub" in prompt
    assert "0000578111" in prompt
    assert "73499477" in prompt
    assert "BRAKI DANYCH" in prompt


@pytest.mark.anyio
async def test_handle_unknown_tool():
    state = ReportState()
    result = await handle_writer_tool(state, "unknown_tool", {})
    assert result.is_error
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.report_generator'`

- [ ] **Step 3: Implement Writer data layer**

Create `backend/app/services/report_generator.py`:

```python
"""Phase 4: Report generation — Writer + Validator + Reviewer + Reviser."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from dataclasses import dataclass, field

from app.services.claude_client import ClaudeClient, SimpleResult, ToolDefinition, ToolResult

# Section order and Polish titles
SECTION_ORDER = OrderedDict([
    ("executive", "Podsumowanie wykonawcze"),
    ("financial_metrics", "Dane finansowe"),
    ("overall_risk", "Ogólna ocena ryzyka TP"),
    ("financial_ratios", "Wskaźniki finansowe i podatkowe"),
    ("group_structure", "Struktura grupy"),
    ("tp_transactions", "Transakcje z podmiotami powiązanymi"),
    ("balances", "Salda należności i zobowiązań"),
    ("risk_assessment", "Szczegółowa ocena ryzyka"),
    ("priority_matrix", "Matryca priorytetów"),
    ("methodology", "Metodologia i scoring"),
    ("management_context", "Kontekst sprawozdania zarządu"),
])

SECTION_PROPERTIES = {
    key: {
        "type": "object",
        "properties": {
            "summary_md": {"type": "string", "description": f"1-3 sentence summary for '{title}'"},
            "full_md": {"type": "string", "description": f"Full Markdown content for '{title}'"},
        },
        "required": ["summary_md", "full_md"],
    }
    for key, title in SECTION_ORDER.items()
}

WRITER_TOOLS = [
    ToolDefinition(
        name="write_report_sections",
        description="Write all 11 report sections with summary and full Markdown content. "
                    "Each section needs summary_md (1-3 sentences) and full_md (detailed Markdown with tables).",
        input_schema={
            "type": "object",
            "properties": {
                "sections": {
                    "type": "object",
                    "properties": SECTION_PROPERTIES,
                    "required": list(SECTION_ORDER.keys()),
                },
            },
            "required": ["sections"],
        },
    ),
    ToolDefinition(
        name="flag_additional_risk",
        description="Flag a risk or opportunity not identified during scoring. "
                    "Call this for each additional risk/opportunity you identify while writing.",
        input_schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Short Polish name"},
                "category": {"type": "string", "enum": ["tp", "cit", "vat", "ip_box", "custom"]},
                "level": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                "type": {"type": "string", "enum": ["risk", "opportunity"]},
                "description": {"type": "string", "description": "2-3 sentences in Polish"},
                "amount_pln": {"type": ["integer", "null"], "description": "Financial exposure in PLN or null"},
                "reasoning_md": {"type": ["string", "null"], "description": "Detailed Markdown reasoning in Polish"},
            },
            "required": ["name", "category", "level", "type", "description"],
        },
    ),
]


@dataclass
class ReportState:
    """Accumulates Writer tool call results."""
    sections: dict[str, dict] = field(default_factory=dict)
    additional_risks: list[dict] = field(default_factory=list)
    additional_opportunities: list[dict] = field(default_factory=list)


async def handle_writer_tool(state: ReportState, name: str, input_data: dict) -> ToolResult:
    match name:
        case "write_report_sections":
            sections = input_data.get("sections", {})
            for key, content in sections.items():
                state.sections[key] = content
            return ToolResult(content=f"Report sections saved: {list(sections.keys())}")
        case "flag_additional_risk":
            if input_data.get("type") == "opportunity":
                state.additional_opportunities.append(input_data)
            else:
                state.additional_risks.append(input_data)
            return ToolResult(content=f"Flagged: {input_data.get('name')}")
        case _:
            return ToolResult(content=f"Unknown tool: {name}", is_error=True)


WRITER_SYSTEM_PROMPT = """\
You are a senior transfer pricing advisor writing a professional TP risk analysis report \
for a Polish company. You write in Polish, in a professional advisory tone.

Your task: Using the provided extracted financial data and scoring results, write a \
comprehensive 11-section report by calling the write_report_sections tool.

FORMATTING RULES:
- Language: Polish
- Amounts >= 1,000,000 PLN: use "X,X mln PLN" (e.g., "73,5 mln PLN")
- Amounts 100,000-999,999 PLN: use "X tys. PLN" (e.g., "389 tys. PLN")
- Amounts < 100,000 PLN: use full number with spaces (e.g., "54 321 PLN")
- Percentages >= 5%: no decimals (e.g., "27%")
- Percentages < 5%: 1 decimal (e.g., "3,9%")
- Use Markdown tables for numeric comparisons
- Missing data: add "⚠ Brak danych" annotation with explanation

CONTENT RULES:
- Reference specific transactions, entities, and amounts — never write generically
- risk_assessment full_md MUST include actionable recommendations
- executive summary_md should highlight the 2-3 most critical findings
- methodology section should explain the scoring approach and data sources
- If data_gaps exist, acknowledge them explicitly in relevant sections

ADDITIONAL RISKS:
- While writing, if you notice risks or opportunities NOT already identified in the scoring \
  results, call flag_additional_risk for each one. Look for:
  - Structural risks (unusual entity chains, treaty shopping indicators)
  - Regulatory risks (Pillar Two exposure, new OECD guidelines applicability)
  - Contextual risks (combinations of factors that individually seem fine)
  - Opportunities (APA candidates, IP Box potential, structure optimization)\
"""


def build_writer_prompt(
    company_name: str,
    krs: str | None,
    financial_year: int | None,
    financials: dict | None,
    financials_prev: dict | None,
    cost_structure: dict | None,
    tp_transactions: list | None,
    tax_profile: dict | None,
    mgmt_report: dict | None,
    insights: list | None,
    scoring_data: dict,
    data_gaps: list | None,
) -> str:
    parts = [f"Firma: {company_name}"]
    if krs:
        parts[0] += f" (KRS: {krs})"
    if financial_year:
        parts[0] += f", rok obrotowy {financial_year}"

    def _json_section(label: str, data) -> str:
        if data:
            return f"\n=== {label} ===\n{json.dumps(data, ensure_ascii=False, indent=2)}"
        return f"\n=== {label} ===\nBrak danych"

    parts.append(_json_section("DANE FINANSOWE", financials))
    parts.append(_json_section("DANE FINANSOWE (ROK POPRZEDNI)", financials_prev))
    parts.append(_json_section("STRUKTURA KOSZTÓW", cost_structure))
    parts.append(_json_section("TRANSAKCJE TP", tp_transactions))
    parts.append(_json_section("PROFIL PODATKOWY", tax_profile))
    parts.append(_json_section("SPRAWOZDANIE ZARZĄDU", mgmt_report))
    parts.append(_json_section("INSIGHTS Z EKSTRAKCJI", insights))
    parts.append(_json_section("SCORING", scoring_data))
    parts.append(_json_section("BRAKI DANYCH", data_gaps))

    return "\n".join(parts)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/report_generator.py backend/tests/test_report_generator.py
git commit -m "feat: add Writer tool definitions, state, handler, and prompt builder"
```

---

### Task 3: Validator

**Files:**
- Modify: `backend/app/services/report_generator.py`
- Modify: `backend/tests/test_report_generator.py`

Adds deterministic validation checks between Writer output and source data.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_report_generator.py`:

```python
from app.services.report_generator import ValidationResult, validate_report


def _make_full_sections() -> dict:
    return {
        key: {"summary_md": f"Summary for {key}.", "full_md": f"# {key}\n\nPrzychody wyniosły 73,5 mln PLN. Zysk netto 3,1 mln PLN. Ogólna ocena ryzyka: 8/10 (HIGH)."}
        for key in SECTION_ORDER
    }


def test_validate_all_sections_present():
    sections = _make_full_sections()
    result = validate_report(
        sections=sections,
        financials={"revenue": 73500000, "net_profit": 3100000},
        scoring_overall_score=8,
        scoring_overall_level="HIGH",
        data_gaps=[],
    )
    assert result.is_valid
    assert len(result.errors) == 0


def test_validate_missing_section():
    sections = _make_full_sections()
    del sections["executive"]
    result = validate_report(
        sections=sections,
        financials={"revenue": 73500000},
        scoring_overall_score=8,
        scoring_overall_level="HIGH",
        data_gaps=[],
    )
    assert not result.is_valid
    assert any("executive" in e for e in result.errors)


def test_validate_empty_summary():
    sections = _make_full_sections()
    sections["executive"]["summary_md"] = ""
    result = validate_report(
        sections=sections,
        financials={"revenue": 73500000},
        scoring_overall_score=8,
        scoring_overall_level="HIGH",
        data_gaps=[],
    )
    assert not result.is_valid
    assert any("executive" in e and "summary_md" in e for e in result.errors)


def test_validate_score_mismatch():
    sections = _make_full_sections()
    # overall_risk section says 8/10 but we pass score=5
    result = validate_report(
        sections=sections,
        financials={"revenue": 73500000},
        scoring_overall_score=5,
        scoring_overall_level="MEDIUM",
        data_gaps=[],
    )
    assert any("score" in w.lower() for w in result.warnings)


def test_validate_data_gaps_reflected():
    sections = _make_full_sections()
    # Sections don't mention ⚠
    for key in sections:
        sections[key]["full_md"] = f"# {key}\n\nAll data present."
    result = validate_report(
        sections=sections,
        financials={"revenue": 73500000},
        scoring_overall_score=8,
        scoring_overall_level="HIGH",
        data_gaps=[{"field": "ebitda", "reason": "Not disclosed"}],
    )
    assert any("data_gaps" in w.lower() or "brak danych" in w.lower() for w in result.warnings)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v -k "validate"`
Expected: FAIL — `ImportError: cannot import name 'ValidationResult'`

- [ ] **Step 3: Implement Validator**

Add to `backend/app/services/report_generator.py`:

```python
@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def validate_report(
    sections: dict[str, dict],
    financials: dict | None,
    scoring_overall_score: int,
    scoring_overall_level: str,
    data_gaps: list | None,
) -> ValidationResult:
    """Deterministic checks between Writer output and source data."""
    result = ValidationResult()

    # Check 1: All 11 sections present with non-empty content
    for key in SECTION_ORDER:
        if key not in sections:
            result.errors.append(f"Missing section: {key}")
            continue
        section = sections[key]
        if not section.get("summary_md", "").strip():
            result.errors.append(f"Empty summary_md in section: {key}")
        if not section.get("full_md", "").strip():
            result.errors.append(f"Empty full_md in section: {key}")

    # Check 2: Score consistency — check if overall_risk section mentions correct score
    overall_risk_md = sections.get("overall_risk", {}).get("full_md", "")
    score_str = str(scoring_overall_score)
    if overall_risk_md and score_str not in overall_risk_md:
        result.warnings.append(
            f"Score mismatch: overall_risk section does not mention score {scoring_overall_score}"
        )

    # Check 3: Risk level consistency
    if scoring_overall_level == "HIGH" or scoring_overall_level == "CRITICAL":
        risk_md = sections.get("risk_assessment", {}).get("full_md", "").lower()
        if risk_md and ("niskie ryzyko" in risk_md or "low risk" in risk_md):
            result.warnings.append(
                f"Risk level inconsistency: risk_assessment says low risk but scoring={scoring_overall_level}"
            )

    # Check 4: Data gaps reflected
    if data_gaps:
        all_full_md = " ".join(
            s.get("full_md", "") for s in sections.values()
        )
        if "⚠" not in all_full_md and "Brak danych" not in all_full_md:
            result.warnings.append(
                f"Data gaps exist ({len(data_gaps)}) but report has no ⚠/Brak danych annotations"
            )

    return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v -k "validate"`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/report_generator.py backend/tests/test_report_generator.py
git commit -m "feat: add report Validator with completeness and consistency checks"
```

---

### Task 4: Reviewer feedback parser

**Files:**
- Modify: `backend/app/services/report_generator.py`
- Modify: `backend/tests/test_report_generator.py`

Parses the Reviewer's plain-text Markdown response into structured data. The Reviewer prompt and Claude call come in Task 5 — this task focuses on the parser only.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_report_generator.py`:

```python
from app.services.report_generator import ReviewerFeedback, parse_reviewer_feedback


def test_parse_reviewer_feedback_full():
    text = """## Poprawki
- [sekcja: executive] Kwota przychodów zaokrąglona błędnie — 73,5 mln vs 74,2 mln
- [sekcja: risk_assessment] Brak rekomendacji dla transakcji loan

## Nowe insights (do wplecenia w narracje)
- Nietypowo wysoki udział usług zewnętrznych (34% kosztów)
- ETR 12% bez IP Box wskazuje na agresywną optymalizację

## Nowe ryzyka
- name: "Treaty shopping via NL"
  category: tp
  level: MEDIUM
  type: risk
  description: "Struktura z holenderskim holdingiem budzi wątpliwości."
  amount_pln: null
  reasoning_md: "Szczegółowa analiza..."

## Nowe szanse
- name: "APA dla kluczowej transakcji"
  category: tp
  level: MEDIUM
  type: opportunity
  description: "Transakcja kwalifikuje się do APA."
  amount_pln: 50000000
  reasoning_md: null
"""
    fb = parse_reviewer_feedback(text)
    assert isinstance(fb, ReviewerFeedback)
    assert len(fb.corrections) == 2
    assert fb.corrections[0]["section"] == "executive"
    assert "73,5 mln" in fb.corrections[0]["description"]
    assert len(fb.new_insights) == 2
    assert len(fb.new_risks) == 1
    assert fb.new_risks[0]["name"] == "Treaty shopping via NL"
    assert fb.new_risks[0]["level"] == "MEDIUM"
    assert len(fb.new_opportunities) == 1
    assert fb.new_opportunities[0]["amount_pln"] == 50000000


def test_parse_reviewer_feedback_empty():
    text = """## Poprawki

## Nowe insights (do wplecenia w narracje)

## Nowe ryzyka

## Nowe szanse
"""
    fb = parse_reviewer_feedback(text)
    assert len(fb.corrections) == 0
    assert len(fb.new_insights) == 0
    assert len(fb.new_risks) == 0
    assert len(fb.new_opportunities) == 0
    assert not fb.has_feedback


def test_parse_reviewer_feedback_corrections_only():
    text = """## Poprawki
- [sekcja: financial_metrics] Brakuje tabeli YoY

## Nowe insights (do wplecenia w narracje)

## Nowe ryzyka

## Nowe szanse
"""
    fb = parse_reviewer_feedback(text)
    assert len(fb.corrections) == 1
    assert fb.corrections[0]["section"] == "financial_metrics"
    assert fb.has_feedback


def test_parse_reviewer_feedback_malformed_risk_skipped():
    text = """## Poprawki

## Nowe insights (do wplecenia w narracje)

## Nowe ryzyka
- this is malformed and has no name field

## Nowe szanse
"""
    fb = parse_reviewer_feedback(text)
    assert len(fb.new_risks) == 0  # malformed entry skipped
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v -k "parse_reviewer"`
Expected: FAIL — `ImportError: cannot import name 'ReviewerFeedback'`

- [ ] **Step 3: Implement parser**

Add to `backend/app/services/report_generator.py`:

```python
@dataclass
class ReviewerFeedback:
    corrections: list[dict] = field(default_factory=list)
    new_insights: list[str] = field(default_factory=list)
    new_risks: list[dict] = field(default_factory=list)
    new_opportunities: list[dict] = field(default_factory=list)

    @property
    def has_feedback(self) -> bool:
        return bool(self.corrections or self.new_insights or self.new_risks or self.new_opportunities)


def _parse_section(text: str, header: str, next_headers: list[str]) -> str:
    """Extract content between header and next header."""
    pattern = rf"##\s*{re.escape(header)}.*?\n(.*?)(?=##\s*(?:{'|'.join(re.escape(h) for h in next_headers)})|\Z)"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _parse_corrections(block: str) -> list[dict]:
    """Parse correction lines like '- [sekcja: executive] Description'."""
    results = []
    for match in re.finditer(r"-\s*\[sekcja:\s*(\w+)\]\s*(.+)", block):
        results.append({"section": match.group(1), "description": match.group(2).strip()})
    return results


def _parse_insights(block: str) -> list[str]:
    """Parse insight lines like '- Some insight text'."""
    results = []
    for match in re.finditer(r"-\s+(.+)", block):
        text = match.group(1).strip()
        if text:
            results.append(text)
    return results


def _parse_risk_entries(block: str) -> list[dict]:
    """Parse structured risk/opportunity entries."""
    results = []
    # Split on top-level list items that start with "- name:"
    entries = re.split(r"(?=^-\s*name:)", block, flags=re.MULTILINE)
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        parsed = {}
        for field_match in re.finditer(r"(?:^-\s*|\s{2,})(\w+):\s*(.+)", entry, re.MULTILINE):
            key = field_match.group(1).strip()
            value = field_match.group(2).strip().strip('"')
            if value == "null":
                value = None
            elif key == "amount_pln" and value is not None:
                try:
                    value = int(value)
                except ValueError:
                    value = None
            parsed[key] = value
        if "name" in parsed and "category" in parsed:
            results.append(parsed)
    return results


def parse_reviewer_feedback(text: str) -> ReviewerFeedback:
    """Parse Reviewer's plain-text Markdown response into structured feedback."""
    headers = ["Poprawki", "Nowe insights", "Nowe ryzyka", "Nowe szanse"]

    corrections_block = _parse_section(text, "Poprawki", headers[1:])
    insights_block = _parse_section(text, "Nowe insights", headers[2:])
    risks_block = _parse_section(text, "Nowe ryzyka", headers[3:])
    opportunities_block = _parse_section(text, "Nowe szanse", [])

    return ReviewerFeedback(
        corrections=_parse_corrections(corrections_block),
        new_insights=_parse_insights(insights_block),
        new_risks=_parse_risk_entries(risks_block),
        new_opportunities=_parse_risk_entries(opportunities_block),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v -k "parse_reviewer"`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/report_generator.py backend/tests/test_report_generator.py
git commit -m "feat: add Reviewer feedback parser with corrections, insights, and risks"
```

---

### Task 5: ReportGenerator orchestration class

**Files:**
- Modify: `backend/app/services/report_generator.py`
- Modify: `backend/tests/test_report_generator.py`

Builds the `ReportGenerator` class that orchestrates Writer → Validator → Reviewer → Reviser → Persist. Uses mocked Claude calls in tests.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_report_generator.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass

from app.services.report_generator import ReportGenerator, ReportGeneratorResult


def _make_mock_writer_result(sections: dict, extra_risks: list | None = None):
    """Create a mock RunResult that simulates Writer tool calls."""
    tool_calls = [("write_report_sections", {"sections": sections})]
    for risk in (extra_risks or []):
        tool_calls.append(("flag_additional_risk", risk))

    result = MagicMock()
    result.tool_calls = tool_calls
    result.total_input_tokens = 4000
    result.total_output_tokens = 4000
    result.cost_usd = 0.07
    return result


def _make_mock_reviewer_result(text: str):
    """Create a mock SimpleResult for Reviewer."""
    result = MagicMock()
    result.text = text
    result.total_input_tokens = 8000
    result.total_output_tokens = 1500
    result.cost_usd = 0.07
    return result


@pytest.mark.anyio
async def test_report_generator_full_flow():
    """Test Writer → Validator → Reviewer → Reviser → result."""
    sections = {
        key: {"summary_md": f"Summary {key}.", "full_md": f"# {key}\n\nPrzychody 73,5 mln PLN. Score 8/10 (HIGH). ⚠ Brak danych o EBITDA."}
        for key in SECTION_ORDER
    }

    writer_result = _make_mock_writer_result(sections, extra_risks=[
        {"name": "Extra risk", "category": "tp", "level": "MEDIUM", "type": "risk",
         "description": "Found while writing.", "amount_pln": None, "reasoning_md": None}
    ])

    reviewer_text = """## Poprawki
- [sekcja: executive] Dodaj wzmiankę o cash poolingu

## Nowe insights (do wplecenia w narracje)
- Wysoki udział usług zewnętrznych

## Nowe ryzyka

## Nowe szanse
"""
    reviewer_result = _make_mock_reviewer_result(reviewer_text)

    revised_sections = {
        key: {"summary_md": f"Revised summary {key}.", "full_md": f"# {key}\n\nRevised. Score 8/10 (HIGH). ⚠ Brak danych."}
        for key in SECTION_ORDER
    }
    reviser_result = _make_mock_writer_result(revised_sections)

    with patch("app.services.report_generator.ClaudeClient") as MockClient:
        mock_writer = AsyncMock()
        mock_writer.run_with_tools = AsyncMock(side_effect=[writer_result, reviser_result])

        mock_reviewer = AsyncMock()
        mock_reviewer.run_simple = AsyncMock(return_value=reviewer_result)

        MockClient.side_effect = [mock_writer, mock_reviewer]

        generator = ReportGenerator()
        result = await generator.run(
            company_name="HAVI Service Hub Sp. z o.o.",
            krs="0000578111",
            financial_year=2024,
            financials={"revenue": 73500000, "net_profit": 3100000},
            financials_prev=None,
            cost_structure=None,
            tp_transactions=[],
            tax_profile={"etr": 12.5},
            mgmt_report=None,
            insights=None,
            scoring_overall_score=8,
            scoring_overall_level="HIGH",
            scoring_category_scores={"tp": 8},
            scoring_risks=[{"name": "Cash pooling", "level": "HIGH", "category": "tp", "description": "Test"}],
            scoring_opportunities=[],
            data_gaps=[{"field": "ebitda", "reason": "Not disclosed"}],
        )

    assert isinstance(result, ReportGeneratorResult)
    assert len(result.sections) == 11
    assert result.sections["executive"]["summary_md"].startswith("Revised")
    assert len(result.additional_risks) == 1
    assert result.additional_risks[0]["name"] == "Extra risk"
    assert result.reviewer_feedback.has_feedback
    assert result.cost_usd > 0


@pytest.mark.anyio
async def test_report_generator_skips_reviser_when_no_feedback():
    """Test that Reviser is skipped when Reviewer has no feedback."""
    sections = {
        key: {"summary_md": f"Summary {key}.", "full_md": f"# {key}\n\nContent. Score 8/10 (HIGH)."}
        for key in SECTION_ORDER
    }

    writer_result = _make_mock_writer_result(sections)

    reviewer_text = """## Poprawki

## Nowe insights (do wplecenia w narracje)

## Nowe ryzyka

## Nowe szanse
"""
    reviewer_result = _make_mock_reviewer_result(reviewer_text)

    with patch("app.services.report_generator.ClaudeClient") as MockClient:
        mock_writer = AsyncMock()
        mock_writer.run_with_tools = AsyncMock(return_value=writer_result)

        mock_reviewer = AsyncMock()
        mock_reviewer.run_simple = AsyncMock(return_value=reviewer_result)

        MockClient.side_effect = [mock_writer, mock_reviewer]

        generator = ReportGenerator()
        result = await generator.run(
            company_name="Test S.A.",
            krs="0000000001",
            financial_year=2024,
            financials={"revenue": 50000000},
            financials_prev=None,
            cost_structure=None,
            tp_transactions=[],
            tax_profile=None,
            mgmt_report=None,
            insights=None,
            scoring_overall_score=8,
            scoring_overall_level="HIGH",
            scoring_category_scores={"tp": 8},
            scoring_risks=[],
            scoring_opportunities=[],
            data_gaps=[],
        )

    assert len(result.sections) == 11
    assert not result.reviewer_feedback.has_feedback
    # Writer's run_with_tools should be called only once (no Reviser call)
    mock_writer.run_with_tools.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v -k "report_generator"`
Expected: FAIL — `ImportError: cannot import name 'ReportGenerator'`

- [ ] **Step 3: Implement ReportGenerator class**

Add to `backend/app/services/report_generator.py`:

```python
REVIEWER_SYSTEM_PROMPT = """\
You are a senior partner at a Big Four advisory firm reviewing a TP risk analysis report. \
You have deep expertise in Polish transfer pricing regulations, CIT law, and international \
tax planning.

Your task: Review the report below against the source data. Provide feedback in the \
structured format specified.

REVIEW CRITERIA:
1. Verify report consistency with source data (amounts, percentages, scores)
2. Evaluate quality and actionability of recommendations
3. Identify missing conclusions or overlooked risks/opportunities
4. Look for non-obvious patterns: structural risks, regulatory exposure, cross-cutting issues
5. Check that data gaps are properly acknowledged

OUTPUT FORMAT — use EXACTLY these headers:

## Poprawki
- [sekcja: <section_key>] Description of correction needed

## Nowe insights (do wplecenia w narracje)
- Observation to weave into relevant section

## Nowe ryzyka
- name: "Risk name in Polish"
  category: tp|cit|vat|ip_box|custom
  level: CRITICAL|HIGH|MEDIUM|LOW
  type: risk
  description: "2-3 sentences in Polish"
  amount_pln: integer or null
  reasoning_md: "Detailed markdown or null"

## Nowe szanse
- name: "Opportunity name in Polish"
  category: tp|cit|vat|ip_box|custom
  level: CRITICAL|HIGH|MEDIUM|LOW
  type: opportunity
  description: "2-3 sentences in Polish"
  amount_pln: integer or null
  reasoning_md: "Detailed markdown or null"

Leave a section empty if you have nothing to report for it. \
Write all feedback in Polish.\
"""

REVISER_SYSTEM_PROMPT = """\
You are a senior transfer pricing advisor revising a TP risk analysis report based on \
reviewer feedback. Apply the corrections and weave new insights into the appropriate \
sections. Do not change sections that are not mentioned in the feedback.

Use the same formatting rules as the original report:
- Language: Polish
- Amounts >= 1,000,000 PLN: "X,X mln PLN"
- Amounts 100,000-999,999 PLN: "X tys. PLN"
- Missing data: "⚠ Brak danych" annotation
- Use Markdown tables for numeric data

Call write_report_sections with the complete revised report (all 11 sections).\
"""


@dataclass
class ReportGeneratorResult:
    sections: dict[str, dict]
    additional_risks: list[dict]
    additional_opportunities: list[dict]
    reviewer_feedback: ReviewerFeedback
    validation: ValidationResult
    cost_usd: float = 0.0


def _build_reviewer_prompt(
    sections: dict[str, dict],
    writer_prompt_data: str,
    validation: ValidationResult,
) -> str:
    """Build Reviewer input with report + source data + validation results."""
    parts = ["=== RAPORT (wygenerowany) ===\n"]
    for key, title in SECTION_ORDER.items():
        section = sections.get(key, {})
        parts.append(f"### {title} ({key})")
        parts.append(f"**Podsumowanie:** {section.get('summary_md', 'BRAK')}")
        parts.append(f"\n{section.get('full_md', 'BRAK')}\n")

    parts.append(f"\n=== DANE ŹRÓDŁOWE ===\n{writer_prompt_data}")

    parts.append("\n=== WYNIK WALIDACJI ===")
    if validation.errors:
        parts.append(f"Errors: {json.dumps(validation.errors, ensure_ascii=False)}")
    else:
        parts.append("Errors: brak")
    if validation.warnings:
        parts.append(f"Warnings: {json.dumps(validation.warnings, ensure_ascii=False)}")
    else:
        parts.append("Warnings: brak")

    return "\n".join(parts)


def _build_reviser_prompt(
    sections: dict[str, dict],
    feedback: ReviewerFeedback,
) -> str:
    """Build Reviser input with original report + feedback."""
    parts = ["=== ORYGINALNY RAPORT ===\n"]
    for key, title in SECTION_ORDER.items():
        section = sections.get(key, {})
        parts.append(f"### {title} ({key})")
        parts.append(section.get("full_md", "BRAK"))
        parts.append("")

    parts.append("=== FEEDBACK REVIEWERA ===\n")
    if feedback.corrections:
        parts.append("POPRAWKI:")
        for c in feedback.corrections:
            parts.append(f"- [{c['section']}] {c['description']}")
    if feedback.new_insights:
        parts.append("\nNOWE INSIGHTS DO WPLECENIA:")
        for insight in feedback.new_insights:
            parts.append(f"- {insight}")

    return "\n".join(parts)


class ReportGenerator:
    """Orchestrates Writer → Validator → Reviewer → Reviser."""

    def __init__(self):
        self.writer_client = ClaudeClient(model="claude-sonnet-4-6")
        self.reviewer_client = ClaudeClient(model="claude-opus-4-6")

    async def run(
        self,
        company_name: str,
        krs: str | None,
        financial_year: int | None,
        financials: dict | None,
        financials_prev: dict | None,
        cost_structure: dict | None,
        tp_transactions: list | None,
        tax_profile: dict | None,
        mgmt_report: dict | None,
        insights: list | None,
        scoring_overall_score: int,
        scoring_overall_level: str,
        scoring_category_scores: dict | None,
        scoring_risks: list,
        scoring_opportunities: list,
        data_gaps: list | None,
    ) -> ReportGeneratorResult:
        total_cost = 0.0

        # Build shared prompt data
        scoring_data = {
            "overall_score": scoring_overall_score,
            "overall_level": scoring_overall_level,
            "category_scores": scoring_category_scores,
            "risks": scoring_risks,
            "opportunities": scoring_opportunities,
        }
        writer_prompt = build_writer_prompt(
            company_name=company_name,
            krs=krs,
            financial_year=financial_year,
            financials=financials,
            financials_prev=financials_prev,
            cost_structure=cost_structure,
            tp_transactions=tp_transactions,
            tax_profile=tax_profile,
            mgmt_report=mgmt_report,
            insights=insights,
            scoring_data=scoring_data,
            data_gaps=data_gaps,
        )

        # Phase 1: Writer
        state = ReportState()

        async def writer_handler(name: str, input_data: dict) -> ToolResult:
            return await handle_writer_tool(state, name, input_data)

        writer_result = await self.writer_client.run_with_tools(
            system_prompt=WRITER_SYSTEM_PROMPT,
            user_message=writer_prompt,
            tools=WRITER_TOOLS,
            tool_handler=writer_handler,
            max_tokens=16384,
        )
        for tool_name, tool_input in writer_result.tool_calls:
            await handle_writer_tool(state, tool_name, tool_input)
        total_cost += writer_result.cost_usd

        # Phase 2: Validator
        validation = validate_report(
            sections=state.sections,
            financials=financials,
            scoring_overall_score=scoring_overall_score,
            scoring_overall_level=scoring_overall_level,
            data_gaps=data_gaps,
        )

        # Phase 3: Reviewer
        reviewer_prompt = _build_reviewer_prompt(state.sections, writer_prompt, validation)
        reviewer_result = await self.reviewer_client.run_simple(
            system_prompt=REVIEWER_SYSTEM_PROMPT,
            user_message=reviewer_prompt,
            max_tokens=4096,
        )
        total_cost += reviewer_result.cost_usd
        feedback = parse_reviewer_feedback(reviewer_result.text)

        # Phase 4: Reviser (only if feedback exists)
        final_sections = state.sections
        if feedback.has_feedback and (feedback.corrections or feedback.new_insights):
            reviser_prompt = _build_reviser_prompt(state.sections, feedback)
            reviser_state = ReportState()

            async def reviser_handler(name: str, input_data: dict) -> ToolResult:
                return await handle_writer_tool(reviser_state, name, input_data)

            reviser_result = await self.writer_client.run_with_tools(
                system_prompt=REVISER_SYSTEM_PROMPT,
                user_message=reviser_prompt,
                tools=WRITER_TOOLS,
                tool_handler=reviser_handler,
                max_tokens=16384,
            )
            for tool_name, tool_input in reviser_result.tool_calls:
                await handle_writer_tool(reviser_state, tool_name, tool_input)
            total_cost += reviser_result.cost_usd

            if reviser_state.sections:
                final_sections = reviser_state.sections

        return ReportGeneratorResult(
            sections=final_sections,
            additional_risks=state.additional_risks + feedback.new_risks,
            additional_opportunities=state.additional_opportunities + feedback.new_opportunities,
            reviewer_feedback=feedback,
            validation=validation,
            cost_usd=total_cost,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_report_generator.py -v`
Expected: All tests passed (15 total)

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/report_generator.py backend/tests/test_report_generator.py
git commit -m "feat: add ReportGenerator orchestration (Writer → Validator → Reviewer → Reviser)"
```

---

### Task 6: Pipeline integration

**Files:**
- Modify: `backend/app/services/pipeline.py:216-265`
- Modify: `backend/tests/test_pipeline.py`

Wire `ReportGenerator` into the existing pipeline after scoring, add progress tracking, and persist results to DB.

- [ ] **Step 1: Write the failing test**

Replace the existing `test_pipeline_runs_extraction_and_scoring` in `backend/tests/test_pipeline.py` with a test that expects the full pipeline including report generation. Add a new test:

```python
@pytest.mark.anyio
async def test_pipeline_runs_full_with_report_generation(db_session, analysis_with_docs):
    """Test full pipeline: extraction → scoring → report generation."""
    analysis, tmp_path = analysis_with_docs

    mock_extraction_result = MagicMock()
    mock_extraction_result.tool_calls = [
        ("save_financials", {"year": 2024, "revenue": 73499477, "operating_profit": 2854414, "ebit_margin": 3.88, "net_profit": 3142441}),
        ("save_tp_transactions", {"transactions": [{"entity": "HAVI DE", "amount_pln": 11000000, "type": "services", "direction": "inbound"}]}),
        ("save_tax_profile", {"tax_expense": 3528204, "profit_before_tax": 6670644}),
    ]
    mock_extraction_result.total_input_tokens = 5000
    mock_extraction_result.total_output_tokens = 1000
    mock_extraction_result.cost_usd = 0.03

    mock_scoring_result = MagicMock()
    mock_scoring_result.tool_calls = [
        ("add_risk", {"name": "Test risk", "category": "tp", "level": "HIGH", "amount_pln": 11000000, "description": "Test", "reasoning_md": "Test reasoning"}),
        ("set_category_score", {"category": "tp", "score": 7, "justification": "High risk"}),
        ("set_overall_score", {"score": 7, "level": "HIGH", "justification_md": "Overall high risk"}),
    ]
    mock_scoring_result.total_input_tokens = 3000
    mock_scoring_result.total_output_tokens = 500
    mock_scoring_result.cost_usd = 0.02

    # Mock ReportGenerator
    from app.services.report_generator import ReportGeneratorResult, ReviewerFeedback, ValidationResult, SECTION_ORDER
    mock_report_result = ReportGeneratorResult(
        sections={key: {"summary_md": f"Sum {key}", "full_md": f"# {key}"} for key in SECTION_ORDER},
        additional_risks=[{"name": "Extra", "category": "tp", "level": "MEDIUM", "type": "risk", "description": "Found by writer"}],
        additional_opportunities=[],
        reviewer_feedback=ReviewerFeedback(),
        validation=ValidationResult(),
        cost_usd=0.15,
    )

    with patch("app.services.pipeline.ClaudeClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.run_with_tools = AsyncMock(
            side_effect=[mock_extraction_result, mock_scoring_result]
        )
        MockClient.return_value = mock_instance

        with patch("app.services.pipeline.ReportGenerator") as MockGenerator:
            mock_gen_instance = AsyncMock()
            mock_gen_instance.run = AsyncMock(return_value=mock_report_result)
            MockGenerator.return_value = mock_gen_instance

            with patch("app.services.pipeline.UPLOAD_BASE_DIR", tmp_path):
                await run_pipeline(analysis.id, db_session)

    await db_session.refresh(analysis)
    assert analysis.status == AnalysisStatus.DONE
    assert analysis.progress_pct == 100
    assert analysis.current_phase.value == "writing"

    # Check report sections were created
    from app.models import ReportSection
    from sqlalchemy import select
    result = await db_session.execute(
        select(ReportSection).where(ReportSection.analysis_id == analysis.id)
    )
    report_sections = result.scalars().all()
    assert len(report_sections) == 11

    # Check additional risk was persisted
    from app.models import RiskAndOpportunity
    result = await db_session.execute(
        select(RiskAndOpportunity).where(RiskAndOpportunity.analysis_id == analysis.id)
    )
    all_risks = result.scalars().all()
    # 1 from scoring + 1 from writer
    assert len(all_risks) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_pipeline.py::test_pipeline_runs_full_with_report_generation -v`
Expected: FAIL — `ImportError` or `AttributeError` (ReportGenerator not wired in pipeline)

- [ ] **Step 3: Modify pipeline.py to add WRITING phase**

In `backend/app/services/pipeline.py`, add import at top:

```python
from app.services.report_generator import (
    ReportGenerator,
    ReportGeneratorResult,
    SECTION_ORDER,
)
from app.models import ReportSection, SectionType
```

Then replace the final section of `run_pipeline()` (after scoring persist, around line 251) — replace from `await _update_progress(analysis, db, status=AnalysisStatus.DONE, ...)` to just before the `except` block:

```python
        await db.commit()

        # Phase 4: Report Generation
        await _update_progress(
            analysis, db,
            phase=AnalysisPhase.WRITING,
            pct=80,
            message="Generowanie raportu...",
        )

        scoring_obj = await db.get(Scoring, analysis_id)
        generator = ReportGenerator()
        report_result = await generator.run(
            company_name=company.name,
            krs=company.krs,
            financial_year=analysis.financial_year,
            financials=extracted_data.financials,
            financials_prev=extracted_data.financials_prev,
            cost_structure=extracted_data.cost_structure,
            tp_transactions=extracted_data.tp_transactions,
            tax_profile=extracted_data.tax_profile,
            mgmt_report=extracted_data.mgmt_report,
            insights=extracted_data.insights,
            scoring_overall_score=scoring_obj.overall_score if scoring_obj else 0,
            scoring_overall_level=scoring_obj.overall_level.value if scoring_obj else "LOW",
            scoring_category_scores=scoring_obj.category_scores if scoring_obj else {},
            scoring_risks=scoring_state.risks,
            scoring_opportunities=scoring_state.opportunities,
            data_gaps=extracted_data.data_gaps,
        )

        await _update_progress(
            analysis, db, pct=90,
            message="Zapisywanie raportu...",
            cost_usd=report_result.cost_usd,
        )

        # Persist report sections
        for order, (key, title) in enumerate(SECTION_ORDER.items(), 1):
            section_data = report_result.sections.get(key, {})
            db.add(ReportSection(
                analysis_id=analysis_id,
                section_key=key,
                title=title,
                summary_md=section_data.get("summary_md"),
                full_md=section_data.get("full_md"),
                section_type=SectionType.FIXED,
                display_order=order,
            ))

        # Persist additional risks from Writer + Reviewer
        for risk in report_result.additional_risks:
            db.add(RiskAndOpportunity(
                analysis_id=analysis_id,
                type=RiskType.RISK,
                category=risk.get("category", "custom"),
                name=risk["name"],
                description=risk.get("description", ""),
                level=RiskLevel(risk.get("level", "MEDIUM")),
                amount_pln=risk.get("amount_pln"),
                reasoning_md=risk.get("reasoning_md"),
            ))

        for opp in report_result.additional_opportunities:
            db.add(RiskAndOpportunity(
                analysis_id=analysis_id,
                type=RiskType.OPPORTUNITY,
                category=opp.get("category", "custom"),
                name=opp["name"],
                description=opp.get("description", ""),
                level=RiskLevel(opp.get("level", "MEDIUM")),
                amount_pln=opp.get("amount_pln"),
                reasoning_md=opp.get("reasoning_md"),
            ))

        await db.commit()

        await _update_progress(
            analysis, db,
            status=AnalysisStatus.DONE,
            pct=100,
            message="Analiza zakończona.",
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_pipeline.py -v`
Expected: All pipeline tests pass

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v`
Expected: All tests pass (previous 67 + new ~17 = ~84 total)

- [ ] **Step 6: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: integrate ReportGenerator into pipeline with WRITING phase and persist"
```

---

### Task 7: Update existing pipeline test

**Files:**
- Modify: `backend/tests/test_pipeline.py`

The existing `test_pipeline_runs_extraction_and_scoring` test will now fail because the pipeline expects ReportGenerator. Update it to mock the report generator.

- [ ] **Step 1: Update the existing test**

In `backend/tests/test_pipeline.py`, update `test_pipeline_runs_extraction_and_scoring` to add the ReportGenerator mock. Add after the `MockClient` patch:

```python
        with patch("app.services.pipeline.ReportGenerator") as MockGenerator:
            mock_gen_instance = AsyncMock()
            mock_gen_instance.run = AsyncMock(return_value=MagicMock(
                sections={},
                additional_risks=[],
                additional_opportunities=[],
                cost_usd=0.0,
            ))
            MockGenerator.return_value = mock_gen_instance
```

Also update the assertion — the pipeline now finishes at `pct=100` and `phase=writing`, not `pct=80`:

```python
    assert analysis.progress_pct == 100
```

- [ ] **Step 2: Run existing tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_pipeline.py -v`
Expected: All pipeline tests pass

- [ ] **Step 3: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/tests/test_pipeline.py
git commit -m "test: update existing pipeline test to mock ReportGenerator"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v --tb=short`
Expected: All tests pass

- [ ] **Step 2: Verify import structure**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run python -c "from app.services.report_generator import ReportGenerator, WRITER_TOOLS, SECTION_ORDER, validate_report, parse_reviewer_feedback; print('All imports OK')"`
Expected: `All imports OK`

- [ ] **Step 3: Verify no lint issues**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run python -m py_compile app/services/report_generator.py && uv run python -m py_compile app/services/claude_client.py && uv run python -m py_compile app/services/pipeline.py && echo "Compilation OK"`
Expected: `Compilation OK`

- [ ] **Step 4: Final commit summary**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git log --oneline -8
```

Expected commits (newest first):
1. `test: update existing pipeline test to mock ReportGenerator`
2. `feat: integrate ReportGenerator into pipeline with WRITING phase and persist`
3. `feat: add ReportGenerator orchestration (Writer → Validator → Reviewer → Reviser)`
4. `feat: add Reviewer feedback parser with corrections, insights, and risks`
5. `feat: add report Validator with completeness and consistency checks`
6. `feat: add Writer tool definitions, state, handler, and prompt builder`
7. `feat: add run_simple() to ClaudeClient for non-tool-use calls`
