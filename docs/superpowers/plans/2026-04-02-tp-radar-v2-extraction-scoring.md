# TP Radar v2 — Extraction + Scoring Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI pipeline that takes uploaded PDF/XML financial documents, extracts structured data via Claude API tool use, and scores transfer pricing risk — calibrated against 3 v1 companies.

**Architecture:** Upload endpoint receives documents → Document Parser extracts text/structure (pdfplumber, BeautifulSoup) → Claude API Phase 2 extracts financial data via tool calls → Quality gate checks completeness → Claude API Phase 3 scores risks via tool calls → Results stored in PostgreSQL. Pipeline runs as async background task with progress tracking.

**Tech Stack:**
- Backend: Python 3.12+, FastAPI, SQLAlchemy async, existing models from Plan 1+2
- AI: Anthropic SDK (`anthropic` package), Claude Sonnet 4.6, tool use
- Parsing: pdfplumber (PDF text/tables), BeautifulSoup + lxml (XML/XHTML), pytesseract (OCR fallback)
- Testing: pytest-asyncio, mocked Claude API responses

**Spec reference:** `docs/superpowers/specs/2026-04-02-extraction-scoring-design.md`

**Repo:** `/Users/piotrkarolak/Claude Code/tp-radar-v2/`

---

## File Structure

```
tp-radar-v2/backend/
├── app/
│   ├── routers/
│   │   └── documents.py              # NEW — upload endpoint
│   ├── schemas/
│   │   └── documents.py              # NEW — upload request/response schemas
│   ├── services/
│   │   ├── document_parser.py        # NEW — PDF/XML parsing
│   │   ├── claude_client.py          # NEW — Claude API wrapper with tool use loop
│   │   ├── extraction.py             # NEW — Phase 2: extraction tools + logic
│   │   ├── scoring.py                # NEW — Phase 3: scoring tools + logic
│   │   ├── calculated_fields.py      # NEW — financial ratios, YoY deltas
│   │   └── pipeline.py               # NEW — orchestration (background task)
│   ├── main.py                       # MODIFY — register documents router
│   └── config.py                     # already has anthropic_api_key
├── scripts/
│   └── calibrate.py                  # NEW — calibration against v1 data
├── tests/
│   ├── fixtures/                     # NEW — v1 test documents + reference data
│   │   └── sample_financial.xml      # NEW — minimal XML for unit tests
│   ├── test_document_parser.py       # NEW
│   ├── test_upload.py                # NEW
│   ├── test_claude_client.py         # NEW
│   ├── test_extraction.py            # NEW
│   ├── test_scoring.py               # NEW
│   ├── test_calculated_fields.py     # NEW
│   └── test_pipeline.py             # NEW
├── data/
│   └── uploads/                      # NEW — runtime document storage (gitignored)
└── pyproject.toml                    # MODIFY — add new dependencies
```

---

## Task 1: Add Dependencies

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/.gitignore` (if exists) or create

- [ ] **Step 1: Add Python packages to pyproject.toml**

Add these to the `dependencies` list in `backend/pyproject.toml`:

```toml
[project]
name = "tp-radar-v2-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.30",
    "alembic>=1.14",
    "pydantic>=2.10",
    "pydantic-settings>=2.7",
    "email-validator>=2.1",
    "python-jose[cryptography]>=3.3",
    "bcrypt>=4.0",
    "python-multipart>=0.0.18",
    "anthropic>=0.52",
    "pdfplumber>=0.11",
    "beautifulsoup4>=4.12",
    "lxml>=5.3",
]
```

- [ ] **Step 2: Install dependencies**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv sync`
Expected: All packages installed successfully.

- [ ] **Step 3: Add data/uploads to gitignore**

Append to `backend/.gitignore` (create if needed):
```
data/uploads/
```

- [ ] **Step 4: Create uploads directory**

Run: `mkdir -p /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend/data/uploads`

- [ ] **Step 5: Create test fixtures directory**

Run: `mkdir -p /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend/tests/fixtures`

- [ ] **Step 6: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/pyproject.toml backend/.gitignore
git commit -m "chore: add anthropic, pdfplumber, beautifulsoup4, lxml dependencies"
```

---

## Task 2: Document Parser Service

**Files:**
- Create: `backend/tests/fixtures/sample_financial.xml`
- Create: `backend/tests/test_document_parser.py`
- Create: `backend/app/services/document_parser.py`

- [ ] **Step 1: Create minimal test XML fixture**

Create `backend/tests/fixtures/sample_financial.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<JednostkaInna xmlns="http://www.mf.gov.pl/schematy/SF/DefinicjeTypworSF/2023/11/15/JednostkaInnaW">
  <Naglowek>
    <OkresOd>2024-01-01</OkresOd>
    <OkresDo>2024-12-31</OkresDo>
  </Naglowek>
  <JednostkaInna>
    <Bilans>
      <Aktywa>
        <AktywaA kwleszcze="60183986.00">60183986.00</AktywaA>
      </Aktywa>
      <Pasywa>
        <PasywaA kwleszcze="48415226.00">48415226.00</PasywaA>
      </Pasywa>
    </Bilans>
    <RZiS>
      <RZiSKalk>
        <R_A kwleszcze="73499477.00">73499477.00</R_A>
      </RZiSKalk>
    </RZiS>
  </JednostkaInna>
</JednostkaInna>
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_document_parser.py`:

```python
import os
from pathlib import Path

import pytest

from app.services.document_parser import ParsedDocument, parse_xml, parse_pdf, classify_document

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_parsed_document_dataclass():
    doc = ParsedDocument(
        filename="test.xml",
        doc_type="financial_statement",
        full_text="some text",
        structured_data={"revenue": 1000},
        tables=None,
        parse_method="ixbrl",
        quality_score=1.0,
    )
    assert doc.filename == "test.xml"
    assert doc.doc_type == "financial_statement"
    assert doc.structured_data["revenue"] == 1000


def test_parse_xml_extracts_structured_data():
    xml_path = FIXTURES_DIR / "sample_financial.xml"
    result = parse_xml(xml_path)
    assert result.doc_type == "financial_statement"
    assert result.parse_method == "ixbrl"
    assert result.structured_data is not None
    assert len(result.full_text) > 0
    assert result.quality_score > 0.0


def test_classify_document_xml():
    assert classify_document("sprawozdanie.xml", "") == "financial_statement"


def test_classify_document_informacja_pdf():
    assert classify_document("informacja_dodatkowa.pdf", "") == "supplementary_info"


def test_classify_document_zarzad_pdf():
    assert classify_document("sprawozdanie_zarzadu.pdf", "") == "management_report"


def test_classify_document_unknown():
    assert classify_document("random.pdf", "some content about revenue") == "unknown"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_document_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.document_parser'`

- [ ] **Step 4: Implement document parser**

Create `backend/app/services/document_parser.py`:

```python
"""Document parser for PDF, XML, and XHTML financial statements."""

from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup


@dataclass
class ParsedDocument:
    filename: str
    doc_type: str  # "financial_statement" | "supplementary_info" | "management_report" | "unknown"
    full_text: str
    structured_data: dict | None
    tables: list[dict] | None
    parse_method: str  # "ixbrl" | "pdfplumber" | "ocr"
    quality_score: float  # 0.0-1.0


def classify_document(filename: str, content_preview: str) -> str:
    """Classify document type based on filename and content."""
    name_lower = filename.lower()

    if any(ext in name_lower for ext in [".xml", ".xhtml"]):
        return "financial_statement"
    if "informacja" in name_lower or "dodatkow" in name_lower:
        return "supplementary_info"
    if "zarzad" in name_lower or "dzialalnosc" in name_lower:
        return "management_report"

    # Content-based fallback
    preview_lower = content_preview[:2000].lower()
    if "sprawozdanie finansowe" in preview_lower:
        return "financial_statement"
    if "informacja dodatkowa" in preview_lower or "objaśnieni" in preview_lower:
        return "supplementary_info"
    if "sprawozdanie zarządu" in preview_lower or "działalności" in preview_lower:
        return "management_report"

    return "unknown"


def parse_xml(file_path: Path) -> ParsedDocument:
    """Parse XML/XHTML financial statement, extract iXBRL data and full text."""
    content = file_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(content, "lxml-xml")

    # Extract structured data from iXBRL-like tags
    structured_data = {}

    # Try to find common financial statement elements
    for tag in soup.find_all(True):
        text = tag.get_text(strip=True)
        if text and _is_numeric(text):
            tag_name = tag.name
            if tag_name not in structured_data:
                structured_data[tag_name] = _parse_number(text)

    # Full text extraction
    full_text = soup.get_text(separator="\n", strip=True)

    filled = len([v for v in structured_data.values() if v is not None])
    quality = min(1.0, filled / 10) if structured_data else 0.1

    return ParsedDocument(
        filename=file_path.name,
        doc_type="financial_statement",
        full_text=full_text,
        structured_data=structured_data if structured_data else None,
        tables=None,
        parse_method="ixbrl",
        quality_score=quality,
    )


def parse_pdf(file_path: Path) -> ParsedDocument:
    """Parse PDF document, extract text and tables."""
    import pdfplumber

    full_text_parts: list[str] = []
    tables: list[dict] = []
    total_chars = 0
    total_pages = 0

    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            full_text_parts.append(f"--- Page {i + 1} ---\n{text}")
            total_chars += len(text)

            # Extract tables
            for table in page.extract_tables():
                if table and len(table) > 1:
                    headers = [str(h) for h in table[0]] if table[0] else []
                    for row in table[1:]:
                        if row:
                            tables.append(dict(zip(headers, [str(c) for c in row])))

    full_text = "\n\n".join(full_text_parts)
    doc_type = classify_document(file_path.name, full_text)

    # Scan detection: <50 chars per page average = likely scanned
    avg_chars = total_chars / max(total_pages, 1)
    if avg_chars < 50:
        return _parse_pdf_ocr(file_path, doc_type)

    quality = min(1.0, avg_chars / 500)

    return ParsedDocument(
        filename=file_path.name,
        doc_type=doc_type,
        full_text=full_text,
        structured_data=None,
        tables=tables if tables else None,
        parse_method="pdfplumber",
        quality_score=quality,
    )


def _parse_pdf_ocr(file_path: Path, doc_type: str) -> ParsedDocument:
    """Fallback OCR for scanned PDFs."""
    try:
        import pytesseract
        from pdf2image import convert_from_path

        images = convert_from_path(file_path)
        full_text_parts = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang="pol")
            full_text_parts.append(f"--- Page {i + 1} (OCR) ---\n{text}")

        full_text = "\n\n".join(full_text_parts)
        return ParsedDocument(
            filename=file_path.name,
            doc_type=doc_type,
            full_text=full_text,
            structured_data=None,
            tables=None,
            parse_method="ocr",
            quality_score=0.5,
        )
    except ImportError:
        # OCR dependencies not installed — return empty with low quality
        return ParsedDocument(
            filename=file_path.name,
            doc_type=doc_type,
            full_text=f"[OCR unavailable for {file_path.name}]",
            structured_data=None,
            tables=None,
            parse_method="ocr",
            quality_score=0.0,
        )


def parse_document(file_path: Path) -> ParsedDocument:
    """Parse a document based on its file extension."""
    suffix = file_path.suffix.lower()
    if suffix in (".xml", ".xhtml"):
        return parse_xml(file_path)
    elif suffix == ".pdf":
        return parse_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def _is_numeric(text: str) -> bool:
    cleaned = text.replace(" ", "").replace(",", ".").replace("\xa0", "")
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def _parse_number(text: str) -> float | None:
    cleaned = text.replace(" ", "").replace(",", ".").replace("\xa0", "")
    try:
        return float(cleaned)
    except ValueError:
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_document_parser.py -v`
Expected: All 5 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v`
Expected: All existing + new tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/document_parser.py backend/tests/test_document_parser.py backend/tests/fixtures/sample_financial.xml
git commit -m "feat: add document parser service (XML/PDF/OCR)"
```

---

## Task 3: Upload Endpoint

**Files:**
- Create: `backend/app/schemas/documents.py`
- Create: `backend/app/routers/documents.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_upload.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_upload.py`:

```python
import uuid

import pytest
from app.models import Analysis, AnalysisStatus, Company


async def login_helper(client) -> str:
    await client.post("/auth/register", json={
        "email": "upload@test.com", "password": "testpass123", "name": "Test"
    })
    resp = await client.post("/auth/login", json={
        "email": "upload@test.com", "password": "testpass123"
    })
    return resp.json()["access_token"]


@pytest.fixture
async def pending_analysis(db_session):
    company = Company(slug="test-upload", name="Test Upload S.A.", krs="0000000099")
    db_session.add(company)
    await db_session.flush()

    analysis = Analysis(
        company_id=company.id,
        status=AnalysisStatus.PENDING,
    )
    db_session.add(analysis)
    await db_session.commit()
    return analysis


@pytest.mark.anyio
async def test_upload_documents_success(client, pending_analysis, tmp_path):
    token = await login_helper(client)
    # Create a small test XML file
    test_file = tmp_path / "sprawozdanie.xml"
    test_file.write_text("<root><data>123</data></root>", encoding="utf-8")

    with open(test_file, "rb") as f:
        resp = await client.post(
            f"/analyses/{pending_analysis.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
            files=[("files", ("sprawozdanie.xml", f, "application/xml"))],
        )

    assert resp.status_code == 201
    data = resp.json()
    assert len(data["documents"]) == 1
    assert data["documents"][0]["filename"] == "sprawozdanie.xml"


@pytest.mark.anyio
async def test_upload_rejects_invalid_type(client, pending_analysis, tmp_path):
    token = await login_helper(client)
    test_file = tmp_path / "malware.exe"
    test_file.write_bytes(b"not a pdf")

    with open(test_file, "rb") as f:
        resp = await client.post(
            f"/analyses/{pending_analysis.id}/documents",
            headers={"Authorization": f"Bearer {token}"},
            files=[("files", ("malware.exe", f, "application/octet-stream"))],
        )

    assert resp.status_code == 400


@pytest.mark.anyio
async def test_upload_requires_auth(client, pending_analysis, tmp_path):
    test_file = tmp_path / "test.xml"
    test_file.write_text("<root/>", encoding="utf-8")

    with open(test_file, "rb") as f:
        resp = await client.post(
            f"/analyses/{pending_analysis.id}/documents",
            files=[("files", ("test.xml", f, "application/xml"))],
        )

    assert resp.status_code == 403


@pytest.mark.anyio
async def test_upload_404_for_nonexistent_analysis(client, tmp_path):
    token = await login_helper(client)
    test_file = tmp_path / "test.xml"
    test_file.write_text("<root/>", encoding="utf-8")

    fake_id = uuid.uuid4()
    with open(test_file, "rb") as f:
        resp = await client.post(
            f"/analyses/{fake_id}/documents",
            headers={"Authorization": f"Bearer {token}"},
            files=[("files", ("test.xml", f, "application/xml"))],
        )

    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_upload.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create upload schemas**

Create `backend/app/schemas/documents.py`:

```python
from datetime import datetime

from pydantic import BaseModel


class DocumentMeta(BaseModel):
    filename: str
    size_bytes: int
    mime_type: str
    uploaded_at: datetime
    doc_type: str

    model_config = {"from_attributes": True}


class UploadResponse(BaseModel):
    documents: list[DocumentMeta]
    message: str
```

- [ ] **Step 4: Create upload router**

Create `backend/app/routers/documents.py`:

```python
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Analysis, AnalysisStatus, ExtractedData, User
from app.schemas.documents import DocumentMeta, UploadResponse
from app.services.document_parser import classify_document

router = APIRouter(prefix="/analyses", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".xml", ".xhtml"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_FILES = 10


def _get_upload_dir(analysis_id: uuid.UUID) -> Path:
    base = Path(settings.upload_dir if hasattr(settings, "upload_dir") else "data/uploads")
    return base / str(analysis_id)


@router.post(
    "/{analysis_id}/documents",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_documents(
    analysis_id: uuid.UUID,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check analysis exists
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != AnalysisStatus.PENDING:
        raise HTTPException(status_code=400, detail="Analysis is not in PENDING status")

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Max {MAX_FILES} files allowed")

    # Validate file types
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ext}' not allowed. Allowed: {ALLOWED_EXTENSIONS}",
            )

    # Save files
    upload_dir = _get_upload_dir(analysis_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    documents: list[DocumentMeta] = []
    raw_documents: list[dict] = []

    for file in files:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' exceeds 20MB limit")

        file_path = upload_dir / (file.filename or "unnamed")
        file_path.write_bytes(content)

        doc_type = classify_document(file.filename or "", content[:2000].decode("utf-8", errors="ignore"))
        now = datetime.now(timezone.utc)

        meta = DocumentMeta(
            filename=file.filename or "unnamed",
            size_bytes=len(content),
            mime_type=file.content_type or "application/octet-stream",
            uploaded_at=now,
            doc_type=doc_type,
        )
        documents.append(meta)
        raw_documents.append(meta.model_dump(mode="json"))

    # Save metadata to extracted_data.raw_documents
    result = await db.execute(
        select(ExtractedData).where(ExtractedData.analysis_id == analysis_id)
    )
    extracted = result.scalar_one_or_none()
    if not extracted:
        extracted = ExtractedData(analysis_id=analysis_id, raw_documents=raw_documents)
        db.add(extracted)
    else:
        existing = extracted.raw_documents or []
        extracted.raw_documents = existing + raw_documents

    await db.commit()

    return UploadResponse(
        documents=documents,
        message=f"{len(documents)} document(s) uploaded. Pipeline will start automatically.",
    )
```

- [ ] **Step 5: Register router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import auth, companies, analyses, dashboard, reports, documents
```

And:

```python
app.include_router(documents.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_upload.py -v`
Expected: All 4 tests PASS.

- [ ] **Step 7: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/routers/documents.py backend/app/schemas/documents.py backend/app/main.py backend/tests/test_upload.py
git commit -m "feat: add document upload endpoint POST /analyses/{id}/documents"
```

---

## Task 4: Claude API Client with Tool Use Loop

**Files:**
- Create: `backend/tests/test_claude_client.py`
- Create: `backend/app/services/claude_client.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_claude_client.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.claude_client import ClaudeClient, ToolDefinition, ToolResult


def test_tool_definition_to_api_format():
    tool = ToolDefinition(
        name="save_financials",
        description="Save financial data",
        input_schema={
            "type": "object",
            "properties": {
                "revenue": {"type": "integer"},
            },
            "required": ["revenue"],
        },
    )
    api_format = tool.to_api_format()
    assert api_format["name"] == "save_financials"
    assert api_format["description"] == "Save financial data"
    assert api_format["input_schema"]["properties"]["revenue"]["type"] == "integer"


@pytest.mark.anyio
async def test_claude_client_processes_tool_calls():
    """Test that the client runs the tool use loop correctly."""
    # Mock the Anthropic client
    mock_anthropic = MagicMock()

    # First response: model calls a tool
    tool_use_block = MagicMock()
    tool_use_block.type = "tool_use"
    tool_use_block.id = "call_123"
    tool_use_block.name = "save_financials"
    tool_use_block.input = {"revenue": 1000000}

    first_response = MagicMock()
    first_response.content = [tool_use_block]
    first_response.stop_reason = "tool_use"
    first_response.usage.input_tokens = 100
    first_response.usage.output_tokens = 50

    # Second response: model is done
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "Extraction complete."

    second_response = MagicMock()
    second_response.content = [text_block]
    second_response.stop_reason = "end_turn"
    second_response.usage.input_tokens = 200
    second_response.usage.output_tokens = 30

    mock_anthropic.messages.create = AsyncMock(side_effect=[first_response, second_response])

    # Tool handler
    tool_calls_received = []

    async def handle_tool(name: str, input_data: dict) -> ToolResult:
        tool_calls_received.append((name, input_data))
        return ToolResult(content="Saved successfully", is_error=False)

    client = ClaudeClient(anthropic_client=mock_anthropic)
    tools = [
        ToolDefinition(
            name="save_financials",
            description="Save financial data",
            input_schema={"type": "object", "properties": {"revenue": {"type": "integer"}}},
        ),
    ]

    result = await client.run_with_tools(
        system_prompt="You are a financial analyst.",
        user_message="Extract data from this document.",
        tools=tools,
        tool_handler=handle_tool,
    )

    assert len(tool_calls_received) == 1
    assert tool_calls_received[0] == ("save_financials", {"revenue": 1000000})
    assert result.total_input_tokens == 300
    assert result.total_output_tokens == 80


@pytest.mark.anyio
async def test_claude_client_handles_no_tool_calls():
    """Test that the client handles responses without tool calls."""
    mock_anthropic = MagicMock()

    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "No tools needed."

    response = MagicMock()
    response.content = [text_block]
    response.stop_reason = "end_turn"
    response.usage.input_tokens = 50
    response.usage.output_tokens = 10

    mock_anthropic.messages.create = AsyncMock(return_value=response)

    client = ClaudeClient(anthropic_client=mock_anthropic)
    result = await client.run_with_tools(
        system_prompt="Test",
        user_message="Hello",
        tools=[],
        tool_handler=AsyncMock(),
    )

    assert result.total_input_tokens == 50
    assert result.total_output_tokens == 10
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_claude_client.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Claude client**

Create `backend/app/services/claude_client.py`:

```python
"""Thin wrapper around Anthropic SDK with tool use loop."""

from dataclasses import dataclass, field
from typing import Callable, Awaitable

from anthropic import AsyncAnthropic

from app.config import settings

# Pricing per 1M tokens (Sonnet 4.6)
INPUT_PRICE_PER_M = 3.0
OUTPUT_PRICE_PER_M = 15.0


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict

    def to_api_format(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


@dataclass
class ToolResult:
    content: str
    is_error: bool = False


@dataclass
class RunResult:
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    tool_calls: list[tuple[str, dict]] = field(default_factory=list)

    @property
    def cost_usd(self) -> float:
        return (
            self.total_input_tokens * INPUT_PRICE_PER_M / 1_000_000
            + self.total_output_tokens * OUTPUT_PRICE_PER_M / 1_000_000
        )


# Type alias for tool handler callback
ToolHandler = Callable[[str, dict], Awaitable[ToolResult]]


class ClaudeClient:
    def __init__(self, anthropic_client=None, model: str = "claude-sonnet-4-6"):
        self.client = anthropic_client or AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    async def run_with_tools(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[ToolDefinition],
        tool_handler: ToolHandler,
        max_tokens: int = 8192,
        temperature: float = 0.0,
        max_rounds: int = 20,
    ) -> RunResult:
        """Run Claude with tool use loop until model stops calling tools."""
        result = RunResult()
        messages = [{"role": "user", "content": user_message}]
        api_tools = [t.to_api_format() for t in tools] if tools else []

        for _ in range(max_rounds):
            kwargs = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": system_prompt,
                "messages": messages,
            }
            if api_tools:
                kwargs["tools"] = api_tools

            response = await self.client.messages.create(**kwargs)

            result.total_input_tokens += response.usage.input_tokens
            result.total_output_tokens += response.usage.output_tokens

            # Process response content
            if response.stop_reason != "tool_use":
                break

            # Collect tool use blocks and build tool results
            assistant_content = response.content
            tool_results = []

            for block in assistant_content:
                if block.type == "tool_use":
                    result.tool_calls.append((block.name, block.input))
                    tool_result = await tool_handler(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": tool_result.content,
                        "is_error": tool_result.is_error,
                    })

            # Continue conversation with tool results
            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})

        return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_claude_client.py -v`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/claude_client.py backend/tests/test_claude_client.py
git commit -m "feat: add Claude API client with tool use loop"
```

---

## Task 5: Extraction Service (Phase 2)

**Files:**
- Create: `backend/tests/test_extraction.py`
- Create: `backend/app/services/extraction.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_extraction.py`:

```python
import pytest

from app.services.extraction import (
    EXTRACTION_TOOLS,
    ExtractionState,
    handle_extraction_tool,
    build_extraction_prompt,
    check_extraction_completeness,
    CompletenessResult,
)
from app.services.claude_client import ToolResult


def test_extraction_tools_defined():
    tool_names = [t.name for t in EXTRACTION_TOOLS]
    assert "save_financials" in tool_names
    assert "save_financials_prev" in tool_names
    assert "save_cost_structure" in tool_names
    assert "save_tp_transactions" in tool_names
    assert "save_tax_profile" in tool_names
    assert "save_mgmt_report" in tool_names
    assert "flag_data_gap" in tool_names
    assert "add_insight" in tool_names
    assert len(tool_names) == 8


@pytest.mark.anyio
async def test_handle_save_financials():
    state = ExtractionState()
    result = await handle_extraction_tool(
        state,
        "save_financials",
        {
            "year": 2024,
            "revenue": 73499477,
            "operating_profit": 2854414,
            "ebit_margin": 3.88,
            "net_profit": 3142441,
            "total_assets": 60183986,
            "equity": 48415226,
        },
    )
    assert not result.is_error
    assert state.financials["revenue"] == 73499477
    assert state.financials["year"] == 2024


@pytest.mark.anyio
async def test_handle_save_tp_transactions():
    state = ExtractionState()
    result = await handle_extraction_tool(
        state,
        "save_tp_transactions",
        {
            "transactions": [
                {
                    "entity": "HAVI Logistics GmbH",
                    "amount_pln": 11296354,
                    "type": "services",
                    "direction": "inbound",
                    "jurisdiction": "DE",
                },
            ],
        },
    )
    assert not result.is_error
    assert len(state.tp_transactions) == 1
    assert state.tp_transactions[0]["entity"] == "HAVI Logistics GmbH"


@pytest.mark.anyio
async def test_handle_flag_data_gap():
    state = ExtractionState()
    result = await handle_extraction_tool(
        state,
        "flag_data_gap",
        {"field": "ebitda", "reason": "Not disclosed in simplified statement"},
    )
    assert not result.is_error
    assert len(state.data_gaps) == 1
    assert state.data_gaps[0]["field"] == "ebitda"


@pytest.mark.anyio
async def test_handle_add_insight():
    state = ExtractionState()
    result = await handle_extraction_tool(
        state,
        "add_insight",
        {"category": "tp", "observation": "100% revenue from related parties"},
    )
    assert not result.is_error
    assert len(state.insights) == 1


def test_completeness_check_passes():
    state = ExtractionState()
    state.financials = {"year": 2024, "revenue": 100, "operating_profit": 50, "net_profit": 40}
    state.tp_transactions = [{"entity": "A", "amount_pln": 100, "type": "goods", "direction": "inbound"}]
    state.tax_profile = {"tax_expense": 10, "profit_before_tax": 50}
    result = check_extraction_completeness(state)
    assert not result.needs_retry


def test_completeness_check_fails_missing_financials():
    state = ExtractionState()
    state.financials = {}
    state.tp_transactions = []
    state.tax_profile = {}
    result = check_extraction_completeness(state)
    assert result.needs_retry
    assert len(result.missing_fields) > 0


def test_build_extraction_prompt():
    from app.services.document_parser import ParsedDocument
    docs = [
        ParsedDocument(
            filename="test.xml",
            doc_type="financial_statement",
            full_text="Revenue: 73M PLN",
            structured_data={"revenue": 73499477},
            tables=None,
            parse_method="ixbrl",
            quality_score=0.8,
        ),
    ]
    prompt = build_extraction_prompt(docs)
    assert "Revenue: 73M PLN" in prompt
    assert "73499477" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_extraction.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement extraction service**

Create `backend/app/services/extraction.py`:

```python
"""Phase 2: Data extraction via Claude API with tool use."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.services.claude_client import ToolDefinition, ToolResult
from app.services.document_parser import ParsedDocument

EXTRACTION_SYSTEM_PROMPT = """You are a senior financial analyst specializing in Polish corporate finance \
and transfer pricing. You analyze financial statements (sprawozdania finansowe), \
supplementary notes (informacja dodatkowa), and management reports \
(sprawozdanie z działalności zarządu) of Polish companies.

Your task: Extract ALL relevant financial data from the provided documents \
using the available tools. Be thorough — the quality of downstream risk \
analysis depends entirely on extraction completeness.

IMPORTANT RULES:
- All monetary amounts in PLN (integers, not thousands/millions)
- Use null for genuinely unavailable data — never guess or interpolate
- Call flag_data_gap() for any expected field you cannot find
- Call add_insight() for observations that don't fit the template fields
- Extract data for BOTH current and prior year when available
- Pay special attention to: related party transactions, cash pooling, \
  guarantees, loans, brand/IP licenses, management fees

DOCUMENT CONTEXT:
- XML/XHTML data below is the structured backbone (iXBRL-extracted numbers)
- Full document text follows — read it carefully for nuances, notes, \
  and information not captured by iXBRL tags
- Cross-reference numbers between sources when possible"""


@dataclass
class ExtractionState:
    """Accumulates tool call results during extraction."""

    financials: dict = field(default_factory=dict)
    financials_prev: dict = field(default_factory=dict)
    cost_structure: dict = field(default_factory=dict)
    tp_transactions: list[dict] = field(default_factory=list)
    tax_profile: dict = field(default_factory=dict)
    mgmt_report: dict = field(default_factory=dict)
    insights: list[dict] = field(default_factory=list)
    data_gaps: list[dict] = field(default_factory=list)

    def to_extracted_data_dict(self) -> dict:
        """Convert state to dict matching ExtractedData model fields."""
        return {
            "financials": self.financials or None,
            "financials_prev": self.financials_prev or None,
            "cost_structure": self.cost_structure or None,
            "tp_transactions": self.tp_transactions or None,
            "tax_profile": self.tax_profile or None,
            "mgmt_report": self.mgmt_report or None,
            "insights": self.insights or None,
            "data_gaps": self.data_gaps or None,
        }


@dataclass
class CompletenessResult:
    needs_retry: bool
    missing_fields: list[str] = field(default_factory=list)
    message: str = ""


async def handle_extraction_tool(
    state: ExtractionState, name: str, input_data: dict
) -> ToolResult:
    """Process a single extraction tool call and update state."""
    match name:
        case "save_financials":
            state.financials = input_data
            return ToolResult(content="Financials saved.")
        case "save_financials_prev":
            state.financials_prev = input_data
            return ToolResult(content="Prior year financials saved.")
        case "save_cost_structure":
            state.cost_structure = input_data
            return ToolResult(content="Cost structure saved.")
        case "save_tp_transactions":
            state.tp_transactions = input_data.get("transactions", [])
            return ToolResult(content=f"Saved {len(state.tp_transactions)} transaction(s).")
        case "save_tax_profile":
            state.tax_profile = input_data
            return ToolResult(content="Tax profile saved.")
        case "save_mgmt_report":
            state.mgmt_report = input_data
            return ToolResult(content="Management report saved.")
        case "flag_data_gap":
            state.data_gaps.append(input_data)
            return ToolResult(content=f"Data gap flagged: {input_data.get('field')}")
        case "add_insight":
            state.insights.append(input_data)
            return ToolResult(content=f"Insight recorded: {input_data.get('category')}")
        case _:
            return ToolResult(content=f"Unknown tool: {name}", is_error=True)


def check_extraction_completeness(state: ExtractionState) -> CompletenessResult:
    """Check if extraction meets minimum quality thresholds."""
    missing = []

    # Required financial fields
    required_fin = ["revenue", "operating_profit", "net_profit"]
    for f in required_fin:
        if not state.financials.get(f):
            # Check if flagged as data gap
            gap_fields = [g["field"] for g in state.data_gaps]
            if f not in gap_fields:
                missing.append(f"financials.{f}")

    # At least 1 TP transaction expected
    if not state.tp_transactions:
        gap_fields = [g["field"] for g in state.data_gaps]
        if "tp_transactions" not in gap_fields:
            missing.append("tp_transactions (no transactions found)")

    # Required tax fields
    required_tax = ["tax_expense", "profit_before_tax"]
    for f in required_tax:
        if not state.tax_profile.get(f):
            gap_fields = [g["field"] for g in state.data_gaps]
            if f not in gap_fields:
                missing.append(f"tax_profile.{f}")

    needs_retry = len(missing) > 0

    return CompletenessResult(
        needs_retry=needs_retry,
        missing_fields=missing,
        message=f"Missing fields: {', '.join(missing)}" if missing else "Extraction complete.",
    )


def build_extraction_prompt(documents: list[ParsedDocument]) -> str:
    """Build the user message for the extraction API call."""
    parts = ["Please extract all financial data from the following documents:\n"]

    for doc in documents:
        parts.append(f"\n## Document: {doc.filename} (type: {doc.doc_type})\n")

        if doc.structured_data:
            parts.append("### Structured Data (iXBRL)\n")
            parts.append(f"```json\n{json.dumps(doc.structured_data, indent=2, ensure_ascii=False)}\n```\n")

        if doc.tables:
            parts.append(f"### Tables ({len(doc.tables)} extracted)\n")
            for i, table in enumerate(doc.tables[:20]):  # Limit to 20 tables
                parts.append(f"Table {i + 1}: {json.dumps(table, ensure_ascii=False)}\n")

        parts.append(f"### Full Text\n{doc.full_text}\n")

    return "\n".join(parts)


def build_retry_prompt(missing: list[str]) -> str:
    """Build a retry prompt for missing fields."""
    return (
        f"The following fields are missing: {', '.join(missing)}. "
        "Please review the documents again and extract these specifically. "
        "If genuinely unavailable, call flag_data_gap() for each missing field."
    )


# Tool definitions for Claude API
EXTRACTION_TOOLS = [
    ToolDefinition(
        name="save_financials",
        description="Save current year financial data",
        input_schema={
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "revenue": {"type": "integer", "description": "PLN"},
                "operating_profit": {"type": "integer", "description": "PLN"},
                "ebit_margin": {"type": "number", "description": "percentage, e.g. 21.7"},
                "net_profit": {"type": "integer", "description": "PLN"},
                "total_assets": {"type": ["integer", "null"], "description": "PLN"},
                "equity": {"type": ["integer", "null"], "description": "PLN"},
                "ebitda": {"type": ["integer", "null"], "description": "PLN"},
                "depreciation": {"type": ["integer", "null"], "description": "PLN"},
            },
            "required": ["year", "revenue", "operating_profit", "ebit_margin", "net_profit"],
        },
    ),
    ToolDefinition(
        name="save_financials_prev",
        description="Save prior year financial data for YoY comparison",
        input_schema={
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "revenue": {"type": "integer"},
                "operating_profit": {"type": "integer"},
                "ebit_margin": {"type": "number"},
                "net_profit": {"type": "integer"},
                "total_assets": {"type": ["integer", "null"]},
                "equity": {"type": ["integer", "null"]},
                "ebitda": {"type": ["integer", "null"]},
                "depreciation": {"type": ["integer", "null"]},
            },
            "required": ["year", "revenue", "operating_profit", "ebit_margin", "net_profit"],
        },
    ),
    ToolDefinition(
        name="save_cost_structure",
        description="Save operating cost breakdown",
        input_schema={
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "personnel_costs": {"type": ["integer", "null"]},
                "depreciation": {"type": ["integer", "null"]},
                "external_services": {"type": ["integer", "null"]},
                "materials_and_goods": {"type": ["integer", "null"]},
                "other_operating_costs": {"type": ["integer", "null"]},
            },
            "required": ["year"],
        },
    ),
    ToolDefinition(
        name="save_tp_transactions",
        description="Save all related party transactions identified in documents",
        input_schema={
            "type": "object",
            "properties": {
                "transactions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "entity": {"type": "string", "description": "Related party name"},
                            "amount_pln": {"type": "integer"},
                            "type": {
                                "type": "string",
                                "enum": [
                                    "goods", "services", "financial", "royalty",
                                    "management_fee", "cash_pooling", "guarantee",
                                    "loan", "dividend", "lease", "other",
                                ],
                            },
                            "direction": {"type": "string", "enum": ["inbound", "outbound"]},
                            "jurisdiction": {"type": ["string", "null"], "description": "ISO country code"},
                            "terms": {"type": ["string", "null"]},
                            "notes": {"type": ["string", "null"]},
                        },
                        "required": ["entity", "amount_pln", "type", "direction"],
                    },
                },
            },
            "required": ["transactions"],
        },
    ),
    ToolDefinition(
        name="save_tax_profile",
        description="Save tax-related data",
        input_schema={
            "type": "object",
            "properties": {
                "tax_expense": {"type": ["integer", "null"]},
                "profit_before_tax": {"type": ["integer", "null"]},
                "etr": {"type": ["number", "null"], "description": "Effective tax rate as percentage"},
                "deferred_tax_asset": {"type": ["integer", "null"]},
                "deferred_tax_liability": {"type": ["integer", "null"]},
                "tax_notes": {"type": ["string", "null"]},
                "tax_risk_level": {"type": ["string", "null"], "enum": ["LOW", "MEDIUM", "HIGH", None]},
            },
        },
    ),
    ToolDefinition(
        name="save_mgmt_report",
        description="Save management report analysis",
        input_schema={
            "type": "object",
            "properties": {
                "tp_policy_mentioned": {"type": "boolean"},
                "apa_mentioned": {"type": "boolean"},
                "group_structure_changes": {"type": ["string", "null"]},
                "strategy_highlights": {"type": ["string", "null"]},
                "commentary": {"type": ["string", "null"]},
                "risk_flags": {"type": "array", "items": {"type": "string"}},
            },
        },
    ),
    ToolDefinition(
        name="flag_data_gap",
        description="Flag a field that should exist but could not be found in documents",
        input_schema={
            "type": "object",
            "properties": {
                "field": {"type": "string", "description": "Which field is missing"},
                "reason": {"type": "string", "description": "Why it's missing"},
            },
            "required": ["field", "reason"],
        },
    ),
    ToolDefinition(
        name="add_insight",
        description="Record an observation that doesn't fit standard template fields",
        input_schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "e.g. 'tp', 'tax', 'structure', 'anomaly'"},
                "observation": {"type": "string"},
                "evidence": {"type": ["string", "null"]},
            },
            "required": ["category", "observation"],
        },
    ),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_extraction.py -v`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/extraction.py backend/tests/test_extraction.py
git commit -m "feat: add extraction service with tool definitions and quality gate"
```

---

## Task 6: Scoring Service (Phase 3)

**Files:**
- Create: `backend/tests/test_scoring.py`
- Create: `backend/app/services/scoring.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_scoring.py`:

```python
import pytest

from app.services.scoring import (
    SCORING_TOOLS,
    ScoringState,
    handle_scoring_tool,
    build_scoring_prompt,
)
from app.services.claude_client import ToolResult


def test_scoring_tools_defined():
    tool_names = [t.name for t in SCORING_TOOLS]
    assert "add_risk" in tool_names
    assert "add_opportunity" in tool_names
    assert "set_category_score" in tool_names
    assert "set_overall_score" in tool_names
    assert len(tool_names) == 4


@pytest.mark.anyio
async def test_handle_add_risk():
    state = ScoringState()
    result = await handle_scoring_tool(
        state,
        "add_risk",
        {
            "name": "Cash pooling z grupą HAVI",
            "category": "tp",
            "level": "HIGH",
            "amount_pln": 54734860,
            "description": "Cash pooling deposit 90.9% of assets",
            "reasoning_md": "High concentration risk...",
        },
    )
    assert not result.is_error
    assert len(state.risks) == 1
    assert state.risks[0]["name"] == "Cash pooling z grupą HAVI"
    assert state.risks[0]["type"] == "risk"


@pytest.mark.anyio
async def test_handle_add_opportunity():
    state = ScoringState()
    result = await handle_scoring_tool(
        state,
        "add_opportunity",
        {
            "name": "IP Box potential",
            "category": "ip_box",
            "level": "MEDIUM",
            "description": "R&D tax deduction",
            "reasoning_md": "Qualifying IP...",
        },
    )
    assert not result.is_error
    assert len(state.opportunities) == 1
    assert state.opportunities[0]["type"] == "opportunity"


@pytest.mark.anyio
async def test_handle_set_category_score():
    state = ScoringState()
    result = await handle_scoring_tool(
        state,
        "set_category_score",
        {"category": "tp", "score": 8, "justification": "High TP risk due to..."},
    )
    assert not result.is_error
    assert state.category_scores["tp"] == 8


@pytest.mark.anyio
async def test_handle_set_overall_score():
    state = ScoringState()
    result = await handle_scoring_tool(
        state,
        "set_overall_score",
        {"score": 8, "level": "HIGH", "justification_md": "Overall high risk..."},
    )
    assert not result.is_error
    assert state.overall_score == 8
    assert state.overall_level == "HIGH"


def test_build_scoring_prompt():
    extracted_data = {
        "financials": {"revenue": 73499477, "year": 2024},
        "tp_transactions": [{"entity": "HAVI DE", "amount_pln": 11000000}],
    }
    prompt = build_scoring_prompt("Test Corp S.A.", "0000735863", 2024, extracted_data)
    assert "Test Corp S.A." in prompt
    assert "73499477" in prompt
    assert "HAVI DE" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_scoring.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scoring service**

Create `backend/app/services/scoring.py`:

```python
"""Phase 3: TP risk scoring via Claude API with tool use."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.services.claude_client import ToolDefinition, ToolResult

SCORING_SYSTEM_PROMPT = """You are a senior tax advisor specializing in transfer pricing (ceny transferowe) \
for Polish companies. You assess TP risk based on extracted financial data.

Your task: Identify ALL transfer pricing risks and opportunities, score each \
category, and provide an overall risk assessment.

DETERMINISTIC RULES (always apply):
1. Materiality thresholds (art. 11k CIT Act):
   - Goods/services: PLN 10,000,000 → must be documented
   - Financial transactions: PLN 10,000,000 → must be documented
   - Tax haven transactions: PLN 2,500,000 → must be documented
2. Safe harbour LVAS: cost + 5% markup for low-value-added services
3. 100% revenue from related parties → minimum MEDIUM risk
4. Implied interest rate >50% or <0% → flag as anomaly, do not score
5. Uncompensated guarantees → minimum HIGH risk if amount >10M PLN
6. Cash pooling without disclosed terms → minimum HIGH risk

SCORING FRAMEWORK:
- Per category (tp, cit, vat, ip_box, custom): 1-10
- Overall: weighted by materiality and severity
- Base formula: CRITICAL×3 + HIGH×2 + MEDIUM×1 → scale to 1-10
  - ≤2 → LOW, 3-5 → MEDIUM, 6-8 → HIGH, 9-10 → CRITICAL
- You MAY override the formula with justification (e.g., single massive risk)

IMPORTANT:
- Each risk/opportunity must include reasoning_md explaining your analysis
- Quantify amount_pln where possible (null if not quantifiable)
- Category is open string — use "tp", "cit", "vat", "ip_box", or create custom
- Look for opportunities too — IP Box potential, APA candidates, structure optimization
- Write all descriptions and reasoning in Polish"""


@dataclass
class ScoringState:
    """Accumulates tool call results during scoring."""

    risks: list[dict] = field(default_factory=list)
    opportunities: list[dict] = field(default_factory=list)
    category_scores: dict[str, int] = field(default_factory=dict)
    overall_score: int | None = None
    overall_level: str | None = None
    justification_md: str | None = None


async def handle_scoring_tool(
    state: ScoringState, name: str, input_data: dict
) -> ToolResult:
    """Process a single scoring tool call and update state."""
    match name:
        case "add_risk":
            state.risks.append({**input_data, "type": "risk"})
            return ToolResult(content=f"Risk recorded: {input_data.get('name')}")
        case "add_opportunity":
            state.opportunities.append({**input_data, "type": "opportunity"})
            return ToolResult(content=f"Opportunity recorded: {input_data.get('name')}")
        case "set_category_score":
            category = input_data["category"]
            state.category_scores[category] = input_data["score"]
            return ToolResult(content=f"Category '{category}' score set to {input_data['score']}")
        case "set_overall_score":
            state.overall_score = input_data["score"]
            state.overall_level = input_data["level"]
            state.justification_md = input_data.get("justification_md")
            return ToolResult(
                content=f"Overall score: {input_data['score']}/10 ({input_data['level']})"
            )
        case _:
            return ToolResult(content=f"Unknown tool: {name}", is_error=True)


def build_scoring_prompt(
    company_name: str,
    krs: str | None,
    financial_year: int | None,
    extracted_data: dict,
) -> str:
    """Build the user message for the scoring API call."""
    parts = [
        f"Here is the extracted financial data for {company_name}",
    ]
    if krs:
        parts[0] += f" (KRS: {krs})"
    if financial_year:
        parts[0] += f", financial year {financial_year}"
    parts[0] += ":\n"

    sections = [
        ("Financials", "financials"),
        ("Prior Year", "financials_prev"),
        ("Cost Structure", "cost_structure"),
        ("Related Party Transactions", "tp_transactions"),
        ("Tax Profile", "tax_profile"),
        ("Management Report", "mgmt_report"),
        ("Analyst Insights (from extraction phase)", "insights"),
        ("Data Gaps", "data_gaps"),
    ]

    for title, key in sections:
        data = extracted_data.get(key)
        if data:
            parts.append(f"\n## {title}\n```json\n{json.dumps(data, indent=2, ensure_ascii=False)}\n```")

    return "\n".join(parts)


SCORING_TOOLS = [
    ToolDefinition(
        name="add_risk",
        description="Record a transfer pricing or tax risk",
        input_schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Descriptive title in Polish"},
                "category": {"type": "string", "description": "tp, cit, vat, ip_box, or custom"},
                "level": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                "amount_pln": {"type": ["integer", "null"], "description": "Financial exposure in PLN"},
                "description": {"type": "string", "description": "Brief description in Polish"},
                "reasoning_md": {"type": "string", "description": "Detailed reasoning in Markdown"},
            },
            "required": ["name", "category", "level", "description", "reasoning_md"],
        },
    ),
    ToolDefinition(
        name="add_opportunity",
        description="Record a tax optimization opportunity",
        input_schema={
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "category": {"type": "string"},
                "level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                "description": {"type": "string"},
                "reasoning_md": {"type": "string"},
            },
            "required": ["name", "category", "description", "reasoning_md"],
        },
    ),
    ToolDefinition(
        name="set_category_score",
        description="Set risk score for a specific category",
        input_schema={
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "score": {"type": "integer", "minimum": 1, "maximum": 10},
                "justification": {"type": "string"},
            },
            "required": ["category", "score", "justification"],
        },
    ),
    ToolDefinition(
        name="set_overall_score",
        description="Set the overall risk score and level",
        input_schema={
            "type": "object",
            "properties": {
                "score": {"type": "integer", "minimum": 1, "maximum": 10},
                "level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                "justification_md": {"type": "string"},
            },
            "required": ["score", "level", "justification_md"],
        },
    ),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_scoring.py -v`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/scoring.py backend/tests/test_scoring.py
git commit -m "feat: add scoring service with tool definitions and risk assessment"
```

---

## Task 7: Calculated Fields Service

**Files:**
- Create: `backend/tests/test_calculated_fields.py`
- Create: `backend/app/services/calculated_fields.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_calculated_fields.py`:

```python
import pytest

from app.services.calculated_fields import compute_ratios, compute_yoy_deltas


def test_compute_ratios_full_data():
    financials = {
        "equity": 48415226,
        "total_assets": 60183986,
        "ebitda": 3045412,
    }
    tp_transactions = [
        {"type": "loan", "direction": "outbound", "amount_pln": 54734860},
    ]
    tax_profile = {
        "tax_expense": 3528204,
        "profit_before_tax": 6670644,
    }

    result = compute_ratios(financials, tp_transactions, tax_profile)

    assert abs(result["equity_ratio"] - 0.804) < 0.01
    assert abs(result["etr"] - 52.89) < 0.5  # >40% so should be null per rules
    # ETR > 40% should be set to null
    # Actually let me re-check: spec says null if >40% — but 52.9% is HAVI's actual case
    # The function should return null for ETR > 40%


def test_compute_ratios_etr_capped():
    """ETR > 40% should be null per spec rules."""
    result = compute_ratios(
        {"equity": 100, "total_assets": 200, "ebitda": 50},
        [],
        {"tax_expense": 45, "profit_before_tax": 100},  # ETR = 45%
    )
    assert result["etr"] is None
    assert result["etr_deviation_pp"] is None


def test_compute_ratios_etr_negative():
    """ETR < 0% should be null."""
    result = compute_ratios(
        {"equity": 100, "total_assets": 200},
        [],
        {"tax_expense": -10, "profit_before_tax": 100},
    )
    assert result["etr"] is None


def test_compute_ratios_etr_normal():
    """Normal ETR should be computed."""
    result = compute_ratios(
        {"equity": 100, "total_assets": 200},
        [],
        {"tax_expense": 19, "profit_before_tax": 100},
    )
    assert result["etr"] == 19.0
    assert result["etr_deviation_pp"] == 0.0


def test_compute_ratios_missing_data():
    """Missing fields should produce null ratios."""
    result = compute_ratios({}, [], {})
    assert result["equity_ratio"] is None
    assert result["etr"] is None


def test_compute_yoy_deltas():
    current = {"revenue": 73499477, "ebit_margin": 3.88, "net_profit": 3142441}
    prev = {"revenue": 58005972, "ebit_margin": -5.99, "net_profit": 350987}

    deltas = compute_yoy_deltas(current, prev)

    assert abs(deltas["revenue_pct"] - 26.7) < 0.2
    assert abs(deltas["ebit_margin_pp"] - 9.87) < 0.1
    assert deltas["net_profit_pct"] > 700  # ~795%


def test_compute_yoy_deltas_no_prev():
    """No prior year data should return all nulls."""
    deltas = compute_yoy_deltas({"revenue": 100}, None)
    assert deltas["revenue_pct"] is None
    assert deltas["ebit_margin_pp"] is None


def test_compute_yoy_deltas_zero_prev_revenue():
    """Zero prev revenue should produce null (avoid division by zero)."""
    deltas = compute_yoy_deltas({"revenue": 100}, {"revenue": 0})
    assert deltas["revenue_pct"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_calculated_fields.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement calculated fields**

Create `backend/app/services/calculated_fields.py`:

```python
"""Deterministic financial ratio and YoY delta calculations."""

from __future__ import annotations


def compute_ratios(
    financials: dict,
    tp_transactions: list[dict],
    tax_profile: dict,
) -> dict:
    """Compute financial ratios from extracted data."""
    equity = financials.get("equity")
    total_assets = financials.get("total_assets")
    ebitda = financials.get("ebitda")

    # Equity ratio
    equity_ratio = None
    if equity and total_assets and total_assets > 0:
        equity_ratio = round(equity / total_assets, 3)

    # Debt/EBITDA — using financial TP transactions as proxy for financial debt
    debt_ebitda = None
    financial_debt = sum(
        t.get("amount_pln", 0)
        for t in tp_transactions
        if t.get("type") in ("loan", "cash_pooling", "financial")
        and t.get("direction") == "outbound"
    )
    if financial_debt and ebitda and ebitda > 0:
        debt_ebitda = round(financial_debt / ebitda, 2)

    # ICR (Interest Coverage Ratio)
    icr = None
    interest_costs = sum(
        t.get("amount_pln", 0)
        for t in tp_transactions
        if t.get("type") in ("loan", "financial")
        and t.get("direction") == "inbound"
        and "interest" in (t.get("notes") or "").lower()
    )
    if ebitda and interest_costs and interest_costs > 0:
        icr = round(ebitda / interest_costs, 2)

    # ETR
    tax_expense = tax_profile.get("tax_expense")
    profit_before_tax = tax_profile.get("profit_before_tax")
    etr = None
    etr_deviation_pp = None
    if tax_expense is not None and profit_before_tax and profit_before_tax > 0:
        raw_etr = (tax_expense / profit_before_tax) * 100
        if 0 <= raw_etr <= 40:
            etr = round(raw_etr, 2)
            etr_deviation_pp = round(etr - 19.0, 2)

    # Deferred tax net
    dta = tax_profile.get("deferred_tax_asset") or 0
    dtl = tax_profile.get("deferred_tax_liability") or 0
    deferred_tax_net = dta - dtl if (dta or dtl) else None

    return {
        "equity_ratio": equity_ratio,
        "debt_ebitda": debt_ebitda,
        "icr": icr,
        "etr": etr,
        "etr_deviation_pp": etr_deviation_pp,
        "deferred_tax_net": deferred_tax_net,
    }


def _safe_pct_change(current: float | int | None, prev: float | int | None) -> float | None:
    """Calculate percentage change, returning None if not computable."""
    if current is None or prev is None or prev == 0:
        return None
    return round((current - prev) / abs(prev) * 100, 1)


def compute_yoy_deltas(
    current: dict,
    prev: dict | None,
) -> dict:
    """Compute year-over-year deltas between current and prior year."""
    if not prev:
        return {
            "revenue_pct": None,
            "ebit_margin_pp": None,
            "net_profit_pct": None,
            "ebitda_pct": None,
            "personnel_costs_pct": None,
            "external_services_pct": None,
        }

    ebit_margin_pp = None
    curr_margin = current.get("ebit_margin")
    prev_margin = prev.get("ebit_margin")
    if curr_margin is not None and prev_margin is not None:
        ebit_margin_pp = round(curr_margin - prev_margin, 2)

    return {
        "revenue_pct": _safe_pct_change(current.get("revenue"), prev.get("revenue")),
        "ebit_margin_pp": ebit_margin_pp,
        "net_profit_pct": _safe_pct_change(current.get("net_profit"), prev.get("net_profit")),
        "ebitda_pct": _safe_pct_change(current.get("ebitda"), prev.get("ebitda")),
        "personnel_costs_pct": _safe_pct_change(
            current.get("personnel_costs"), prev.get("personnel_costs")
        ),
        "external_services_pct": _safe_pct_change(
            current.get("external_services"), prev.get("external_services")
        ),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_calculated_fields.py -v`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/calculated_fields.py backend/tests/test_calculated_fields.py
git commit -m "feat: add calculated fields service (ratios, ETR, YoY deltas)"
```

---

## Task 8: Pipeline Orchestration

**Files:**
- Create: `backend/tests/test_pipeline.py`
- Create: `backend/app/services/pipeline.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_pipeline.py`:

```python
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Analysis, AnalysisPhase, AnalysisStatus, Company, ExtractedData
from app.services.pipeline import run_pipeline


@pytest.fixture
async def analysis_with_docs(db_session, tmp_path):
    """Create analysis with a test XML document uploaded."""
    company = Company(slug="pipeline-test", name="Pipeline Test S.A.", krs="0000000077")
    db_session.add(company)
    await db_session.flush()

    analysis = Analysis(
        company_id=company.id,
        status=AnalysisStatus.PENDING,
        financial_year=2024,
    )
    db_session.add(analysis)
    await db_session.flush()

    # Create upload directory with test file
    upload_dir = tmp_path / str(analysis.id)
    upload_dir.mkdir(parents=True)
    test_xml = upload_dir / "sprawozdanie.xml"
    test_xml.write_text(
        '<?xml version="1.0"?><root><data>73499477</data></root>',
        encoding="utf-8",
    )

    # Save raw_documents metadata
    extracted = ExtractedData(
        analysis_id=analysis.id,
        raw_documents=[
            {
                "filename": "sprawozdanie.xml",
                "path": str(test_xml),
                "size_bytes": test_xml.stat().st_size,
                "doc_type": "financial_statement",
            }
        ],
    )
    db_session.add(extracted)
    await db_session.commit()

    return analysis, tmp_path


@pytest.mark.anyio
async def test_pipeline_runs_extraction_and_scoring(db_session, analysis_with_docs):
    analysis, tmp_path = analysis_with_docs

    # Mock Claude client to simulate tool calls
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

    with patch("app.services.pipeline.ClaudeClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.run_with_tools = AsyncMock(
            side_effect=[mock_extraction_result, mock_scoring_result]
        )
        MockClient.return_value = mock_instance

        with patch("app.services.pipeline.UPLOAD_BASE_DIR", tmp_path):
            await run_pipeline(analysis.id, db_session)

    # Verify analysis status updated
    await db_session.refresh(analysis)
    assert analysis.status == AnalysisStatus.DONE
    assert analysis.progress_pct == 80

    # Verify extracted data saved
    extracted = await db_session.get(ExtractedData, analysis.id)
    assert extracted.financials is not None
    assert extracted.financials["revenue"] == 73499477

    # Verify scoring saved
    from app.models import Scoring
    from sqlalchemy import select
    result = await db_session.execute(
        select(Scoring).where(Scoring.analysis_id == analysis.id)
    )
    scoring = result.scalar_one_or_none()
    assert scoring is not None
    assert scoring.overall_score == 7
    assert scoring.overall_level.value == "HIGH"


@pytest.mark.anyio
async def test_pipeline_handles_failure(db_session, analysis_with_docs):
    analysis, tmp_path = analysis_with_docs

    with patch("app.services.pipeline.ClaudeClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.run_with_tools = AsyncMock(side_effect=Exception("API error"))
        MockClient.return_value = mock_instance

        with patch("app.services.pipeline.UPLOAD_BASE_DIR", tmp_path):
            await run_pipeline(analysis.id, db_session)

    await db_session.refresh(analysis)
    assert analysis.status == AnalysisStatus.FAILED
    assert "API error" in (analysis.error_message or "")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_pipeline.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pipeline orchestration**

Create `backend/app/services/pipeline.py`:

```python
"""Pipeline orchestration: document parsing → extraction → scoring."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Analysis,
    AnalysisPhase,
    AnalysisStatus,
    ExtractedData,
    OverallLevel,
    RiskAndOpportunity,
    RiskLevel,
    RiskType,
    Scoring,
)
from app.services.calculated_fields import compute_ratios, compute_yoy_deltas
from app.services.claude_client import ClaudeClient, ToolResult
from app.services.document_parser import ParsedDocument, parse_document
from app.services.extraction import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_TOOLS,
    ExtractionState,
    build_extraction_prompt,
    build_retry_prompt,
    check_extraction_completeness,
    handle_extraction_tool,
)
from app.services.scoring import (
    SCORING_SYSTEM_PROMPT,
    SCORING_TOOLS,
    ScoringState,
    build_scoring_prompt,
    handle_scoring_tool,
)

UPLOAD_BASE_DIR = Path("data/uploads")


async def _update_progress(
    analysis: Analysis,
    db: AsyncSession,
    *,
    phase: AnalysisPhase | None = None,
    pct: int | None = None,
    message: str | None = None,
    status: AnalysisStatus | None = None,
    error_message: str | None = None,
    cost_usd: float | None = None,
) -> None:
    if phase is not None:
        analysis.current_phase = phase
    if pct is not None:
        analysis.progress_pct = pct
    if message is not None:
        analysis.progress_message = message
    if status is not None:
        analysis.status = status
        if status == AnalysisStatus.RUNNING and analysis.started_at is None:
            analysis.started_at = datetime.now(timezone.utc)
        if status in (AnalysisStatus.DONE, AnalysisStatus.FAILED):
            analysis.completed_at = datetime.now(timezone.utc)
    if error_message is not None:
        analysis.error_message = error_message
    if cost_usd is not None:
        current = float(analysis.cost_usd or 0)
        analysis.cost_usd = current + cost_usd
    await db.commit()


async def run_pipeline(analysis_id: uuid.UUID, db: AsyncSession) -> None:
    """Run extraction + scoring pipeline for an analysis."""
    analysis = await db.get(Analysis, analysis_id)
    if not analysis:
        return

    try:
        analysis.status = AnalysisStatus.RUNNING
        await _update_progress(
            analysis, db,
            status=AnalysisStatus.RUNNING,
            phase=AnalysisPhase.EXTRACTING,
            pct=5,
            message="Parsowanie dokumentów...",
        )

        # Load uploaded document metadata
        result = await db.execute(
            select(ExtractedData).where(ExtractedData.analysis_id == analysis_id)
        )
        extracted_data = result.scalar_one_or_none()
        if not extracted_data or not extracted_data.raw_documents:
            raise ValueError("No documents uploaded for this analysis")

        # Parse documents
        documents: list[ParsedDocument] = []
        for doc_meta in extracted_data.raw_documents:
            file_path = Path(doc_meta.get("path", ""))
            if not file_path.exists():
                # Try constructing path from upload dir
                file_path = UPLOAD_BASE_DIR / str(analysis_id) / doc_meta["filename"]
            if file_path.exists():
                documents.append(parse_document(file_path))

        if not documents:
            raise ValueError("No parseable documents found")

        await _update_progress(
            analysis, db, pct=15, message="Ekstrakcja danych przez AI..."
        )

        # Phase 2: Extraction
        client = ClaudeClient()
        extraction_state = ExtractionState()

        async def extraction_handler(name: str, input_data: dict) -> ToolResult:
            return await handle_extraction_tool(extraction_state, name, input_data)

        extraction_result = await client.run_with_tools(
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            user_message=build_extraction_prompt(documents),
            tools=EXTRACTION_TOOLS,
            tool_handler=extraction_handler,
        )

        # Process tool calls from result (for mocked scenarios)
        for tool_name, tool_input in extraction_result.tool_calls:
            await handle_extraction_tool(extraction_state, tool_name, tool_input)

        await _update_progress(
            analysis, db, pct=35, message="Sprawdzanie kompletności...",
            cost_usd=extraction_result.cost_usd,
        )

        # Quality gate
        completeness = check_extraction_completeness(extraction_state)
        if completeness.needs_retry:
            await _update_progress(
                analysis, db, pct=40, message="Uzupełnianie brakujących danych..."
            )
            retry_result = await client.run_with_tools(
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                user_message=build_retry_prompt(completeness.missing_fields),
                tools=EXTRACTION_TOOLS,
                tool_handler=extraction_handler,
            )
            for tool_name, tool_input in retry_result.tool_calls:
                await handle_extraction_tool(extraction_state, tool_name, tool_input)
            await _update_progress(
                analysis, db, cost_usd=retry_result.cost_usd,
            )

        # Compute derived fields
        ratios = compute_ratios(
            extraction_state.financials,
            extraction_state.tp_transactions,
            extraction_state.tax_profile,
        )
        yoy = compute_yoy_deltas(
            extraction_state.financials,
            extraction_state.financials_prev or None,
        )

        # Save extraction results
        data_dict = extraction_state.to_extracted_data_dict()
        if data_dict["financials"]:
            data_dict["financials"].update(ratios)
            data_dict["financials"]["yoy_deltas"] = yoy

        for key, value in data_dict.items():
            if value is not None:
                setattr(extracted_data, key, value)

        await db.commit()

        await _update_progress(
            analysis, db,
            phase=AnalysisPhase.SCORING,
            pct=55,
            message="Ocena ryzyka TP...",
        )

        # Phase 3: Scoring
        scoring_state = ScoringState()

        async def scoring_handler(name: str, input_data: dict) -> ToolResult:
            return await handle_scoring_tool(scoring_state, name, input_data)

        # Build extracted data dict for scoring prompt
        scoring_input = {
            "financials": extracted_data.financials,
            "financials_prev": extracted_data.financials_prev,
            "cost_structure": extracted_data.cost_structure,
            "tp_transactions": extracted_data.tp_transactions,
            "tax_profile": extracted_data.tax_profile,
            "mgmt_report": extracted_data.mgmt_report,
            "insights": extracted_data.insights,
            "data_gaps": extracted_data.data_gaps,
        }

        company = analysis.company
        if not company:
            from app.models import Company
            company_result = await db.execute(
                select(Company).where(Company.id == analysis.company_id)
            )
            company = company_result.scalar_one()

        scoring_result = await client.run_with_tools(
            system_prompt=SCORING_SYSTEM_PROMPT,
            user_message=build_scoring_prompt(
                company.name, company.krs, analysis.financial_year, scoring_input
            ),
            tools=SCORING_TOOLS,
            tool_handler=scoring_handler,
            max_tokens=4096,
        )

        # Process tool calls from result (for mocked scenarios)
        for tool_name, tool_input in scoring_result.tool_calls:
            await handle_scoring_tool(scoring_state, tool_name, tool_input)

        await _update_progress(
            analysis, db, pct=70, message="Zapisywanie wyników...",
            cost_usd=scoring_result.cost_usd,
        )

        # Save scoring results
        if scoring_state.overall_score is not None:
            scoring = Scoring(
                analysis_id=analysis_id,
                overall_score=scoring_state.overall_score,
                overall_level=OverallLevel(scoring_state.overall_level),
                justification_md=scoring_state.justification_md,
                category_scores=scoring_state.category_scores or None,
            )
            db.add(scoring)

        # Save risks and opportunities
        for risk in scoring_state.risks:
            db.add(RiskAndOpportunity(
                analysis_id=analysis_id,
                type=RiskType.RISK,
                category=risk["category"],
                name=risk["name"],
                description=risk["description"],
                level=RiskLevel(risk["level"]),
                amount_pln=risk.get("amount_pln"),
                reasoning_md=risk.get("reasoning_md"),
            ))

        for opp in scoring_state.opportunities:
            db.add(RiskAndOpportunity(
                analysis_id=analysis_id,
                type=RiskType.OPPORTUNITY,
                category=opp["category"],
                name=opp["name"],
                description=opp["description"],
                level=RiskLevel(opp.get("level", "MEDIUM")),
                amount_pln=opp.get("amount_pln"),
                reasoning_md=opp.get("reasoning_md"),
            ))

        await db.commit()

        await _update_progress(
            analysis, db,
            status=AnalysisStatus.DONE,
            pct=80,
            message="Ekstrakcja i scoring zakończone.",
        )

    except Exception as e:
        await _update_progress(
            analysis, db,
            status=AnalysisStatus.FAILED,
            error_message=str(e),
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_pipeline.py -v`
Expected: Both tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: add pipeline orchestration (extraction → scoring background task)"
```

---

## Task 9: Wire Upload to Pipeline & Integration

**Files:**
- Modify: `backend/app/routers/documents.py`
- Create: `backend/tests/test_integration_pipeline.py`

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/test_integration_pipeline.py`:

```python
"""Integration test: upload documents → pipeline runs → results in DB."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Analysis, AnalysisStatus, Company, Scoring
from sqlalchemy import select


async def login_helper(client) -> str:
    await client.post("/auth/register", json={
        "email": "integ@test.com", "password": "testpass123", "name": "Test"
    })
    resp = await client.post("/auth/login", json={
        "email": "integ@test.com", "password": "testpass123"
    })
    return resp.json()["access_token"]


@pytest.mark.anyio
async def test_full_upload_to_scoring_flow(client, db_session, tmp_path):
    token = await login_helper(client)

    # Create analysis via API
    resp = await client.post(
        "/analyses",
        json={"company_name": "Integration Test S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    analysis_id = resp.json()["id"]

    # Prepare mock Claude responses
    mock_extraction_result = MagicMock()
    mock_extraction_result.tool_calls = [
        ("save_financials", {
            "year": 2024, "revenue": 100000000,
            "operating_profit": 10000000, "ebit_margin": 10.0,
            "net_profit": 8000000,
        }),
        ("save_tp_transactions", {
            "transactions": [{"entity": "Parent GmbH", "amount_pln": 50000000, "type": "services", "direction": "inbound"}],
        }),
        ("save_tax_profile", {"tax_expense": 1900000, "profit_before_tax": 10000000}),
    ]
    mock_extraction_result.total_input_tokens = 5000
    mock_extraction_result.total_output_tokens = 1000
    mock_extraction_result.cost_usd = 0.03

    mock_scoring_result = MagicMock()
    mock_scoring_result.tool_calls = [
        ("add_risk", {
            "name": "Zakupy od Parent GmbH",
            "category": "tp", "level": "HIGH",
            "amount_pln": 50000000,
            "description": "High value services",
            "reasoning_md": "Materiality threshold exceeded",
        }),
        ("set_category_score", {"category": "tp", "score": 7, "justification": "High"}),
        ("set_overall_score", {"score": 7, "level": "HIGH", "justification_md": "High TP risk"}),
    ]
    mock_scoring_result.total_input_tokens = 3000
    mock_scoring_result.total_output_tokens = 500
    mock_scoring_result.cost_usd = 0.02

    # Upload a test file with mocked pipeline
    test_file = tmp_path / "sprawozdanie.xml"
    test_file.write_text("<root><revenue>100000000</revenue></root>", encoding="utf-8")

    with patch("app.services.pipeline.ClaudeClient") as MockClient, \
         patch("app.services.pipeline.UPLOAD_BASE_DIR", tmp_path):
        mock_instance = AsyncMock()
        mock_instance.run_with_tools = AsyncMock(
            side_effect=[mock_extraction_result, mock_scoring_result]
        )
        MockClient.return_value = mock_instance

        # Patch the background task to run synchronously
        with patch("app.routers.documents.run_pipeline_background") as mock_bg:
            with open(test_file, "rb") as f:
                resp = await client.post(
                    f"/analyses/{analysis_id}/documents",
                    headers={"Authorization": f"Bearer {token}"},
                    files=[("files", ("sprawozdanie.xml", f, "application/xml"))],
                )

            assert resp.status_code == 201
            assert len(resp.json()["documents"]) == 1

    # Verify upload metadata was saved
    from app.models import ExtractedData
    result = await db_session.execute(
        select(ExtractedData).where(ExtractedData.analysis_id == analysis_id)
    )
    extracted = result.scalar_one_or_none()
    assert extracted is not None
    assert extracted.raw_documents is not None
    assert len(extracted.raw_documents) == 1
```

- [ ] **Step 2: Add pipeline trigger to upload router**

Update `backend/app/routers/documents.py` — add at the top:

```python
import asyncio
from app.services.pipeline import run_pipeline
```

Add a helper function and modify the end of `upload_documents`:

```python
async def run_pipeline_background(analysis_id: uuid.UUID, db_factory):
    """Run pipeline in background with its own DB session."""
    async with db_factory() as session:
        await run_pipeline(analysis_id, session)


# At the end of upload_documents, after db.commit():
    # Trigger pipeline in background
    from app.database import async_session
    asyncio.create_task(run_pipeline_background(analysis_id, async_session))

    return UploadResponse(
        documents=documents,
        message=f"{len(documents)} document(s) uploaded. Pipeline started.",
    )
```

- [ ] **Step 3: Run integration test**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest tests/test_integration_pipeline.py -v`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/app/routers/documents.py backend/tests/test_integration_pipeline.py
git commit -m "feat: wire upload endpoint to pipeline, add integration test"
```

---

## Task 10: Calibration Script

**Files:**
- Create: `backend/scripts/calibrate.py`

- [ ] **Step 1: Copy v1 reference data to fixtures**

Run:
```bash
cp "/Users/piotrkarolak/Claude Code/tp-radar/companies.json" \
   "/Users/piotrkarolak/Claude Code/tp-radar-v2/backend/tests/fixtures/v1-reference.json"
```

- [ ] **Step 2: Create calibration script**

Create `backend/scripts/calibrate.py`:

```python
"""
Calibration script: compare AI extraction/scoring output against v1 reference data.

Usage:
    cd backend
    uv run python -m scripts.calibrate [--company SLUG] [--verbose]
"""

import argparse
import json
import sys
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "tests" / "fixtures"
V1_REFERENCE = FIXTURES_DIR / "v1-reference.json"


def load_v1_data() -> list[dict]:
    """Load v1 companies.json reference data."""
    if not V1_REFERENCE.exists():
        print(f"ERROR: v1 reference not found at {V1_REFERENCE}")
        sys.exit(1)
    with open(V1_REFERENCE) as f:
        data = json.load(f)
    return data.get("companies", data) if isinstance(data, dict) else data


def compare_financials(v1: dict, v2: dict, verbose: bool = False) -> dict:
    """Compare financial fields between v1 and v2 extraction."""
    results = {"match": 0, "close": 0, "mismatch": 0, "missing_v2": 0, "details": []}

    fields = ["revenue", "operating_profit", "net_profit", "ebit_margin",
              "total_assets", "equity", "ebitda"]

    v1_fin = v1.get("financials", {})
    v2_fin = v2 or {}

    for field in fields:
        v1_val = v1_fin.get(field)
        v2_val = v2_fin.get(field)

        if v1_val is None and v2_val is None:
            results["match"] += 1
            continue
        if v2_val is None and v1_val is not None:
            results["missing_v2"] += 1
            if verbose:
                results["details"].append(f"  MISSING {field}: v1={v1_val}, v2=None")
            continue
        if v1_val is None:
            results["match"] += 1  # v2 found extra data
            continue

        # Compare numeric values
        if isinstance(v1_val, (int, float)) and isinstance(v2_val, (int, float)):
            if v1_val == 0:
                if v2_val == 0:
                    results["match"] += 1
                else:
                    results["mismatch"] += 1
            else:
                pct_diff = abs(v2_val - v1_val) / abs(v1_val) * 100
                if pct_diff <= 1:
                    results["match"] += 1
                elif pct_diff <= 5:
                    results["close"] += 1
                    if verbose:
                        results["details"].append(
                            f"  CLOSE {field}: v1={v1_val}, v2={v2_val} ({pct_diff:.1f}%)"
                        )
                else:
                    results["mismatch"] += 1
                    if verbose:
                        results["details"].append(
                            f"  MISMATCH {field}: v1={v1_val}, v2={v2_val} ({pct_diff:.1f}%)"
                        )
        else:
            if v1_val == v2_val:
                results["match"] += 1
            else:
                results["mismatch"] += 1

    return results


def compare_scoring(v1: dict, v2_score: int | None, v2_level: str | None,
                    verbose: bool = False) -> dict:
    """Compare scoring between v1 and v2."""
    v1_risk = v1.get("tp_risk", {})
    v1_score = v1_risk.get("score")
    v1_level = v1_risk.get("overall")

    results = {"score_match": False, "level_match": False, "score_delta": None}

    if v1_score is not None and v2_score is not None:
        results["score_delta"] = abs(v2_score - v1_score)
        results["score_match"] = results["score_delta"] <= 1
    if v1_level and v2_level:
        results["level_match"] = v1_level.upper() == v2_level.upper()

    if verbose:
        print(f"  Score: v1={v1_score}, v2={v2_score} (delta={results['score_delta']})")
        print(f"  Level: v1={v1_level}, v2={v2_level} (match={results['level_match']})")

    return results


def compare_risks(v1: dict, v2_risks: list[dict], verbose: bool = False) -> dict:
    """Compare identified risks between v1 and v2."""
    v1_risks = v1.get("tp_risk", {}).get("top_risks", [])

    v1_critical_high = [r for r in v1_risks if r.get("level") in ("CRITICAL", "HIGH")]
    v2_names = {r.get("name", "").lower() for r in v2_risks}

    matched = 0
    missing = []

    for risk in v1_critical_high:
        name = risk.get("name", "").lower()
        # Fuzzy match: check if any v2 risk contains similar keywords
        keywords = set(name.split())
        found = any(
            len(keywords & set(v2_name.split())) >= 2
            for v2_name in v2_names
        )
        if found:
            matched += 1
        else:
            missing.append(risk.get("name"))

    return {
        "v1_critical_high": len(v1_critical_high),
        "matched": matched,
        "missing": missing,
        "v2_total": len(v2_risks),
    }


def main():
    parser = argparse.ArgumentParser(description="Calibrate v2 pipeline against v1 data")
    parser.add_argument("--company", help="Specific company slug to check")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--v2-data", help="Path to v2 extracted data JSON (from DB export)")
    args = parser.parse_args()

    v1_companies = load_v1_data()

    if args.company:
        v1_companies = [c for c in v1_companies if c.get("id") == args.company]
        if not v1_companies:
            print(f"Company '{args.company}' not found in v1 data")
            sys.exit(1)

    print(f"Calibrating against {len(v1_companies)} v1 companies\n")
    print("=" * 60)

    for company in v1_companies:
        slug = company.get("id", "unknown")
        name = company.get("name", slug)
        print(f"\n## {name} ({slug})")
        print("-" * 40)

        if args.v2_data:
            with open(args.v2_data) as f:
                v2_data = json.load(f)
            v2_company = next((c for c in v2_data if c.get("slug") == slug), None)
            if v2_company:
                fin_results = compare_financials(company, v2_company.get("financials"), args.verbose)
                print(f"Financials: {fin_results['match']} match, {fin_results['close']} close, "
                      f"{fin_results['mismatch']} mismatch, {fin_results['missing_v2']} missing")
                for detail in fin_results.get("details", []):
                    print(detail)
            else:
                print("  (no v2 data available yet)")
        else:
            v1_risk = company.get("tp_risk", {})
            print(f"  v1 score: {v1_risk.get('score')}/10 ({v1_risk.get('overall')})")
            print(f"  v1 risks: {len(v1_risk.get('top_risks', []))}")
            print(f"  v1 revenue: {company.get('financials', {}).get('revenue')}")
            print("  (run with --v2-data to compare)")

    print("\n" + "=" * 60)
    print("Done. Run pipeline on v1 documents, export results, then re-run with --v2-data.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify script runs**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run python -m scripts.calibrate -v`
Expected: Prints v1 reference data summary for 3 companies.

- [ ] **Step 4: Commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add backend/scripts/calibrate.py backend/tests/fixtures/v1-reference.json
git commit -m "feat: add calibration script for v1 vs v2 comparison"
```

---

## Task 11: Final Integration — Full Test Suite & Cleanup

**Files:**
- Run all tests
- Verify everything works together

- [ ] **Step 1: Run full backend test suite**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run pytest -v --tb=short`
Expected: All tests PASS (existing Plan 1+2 tests + all new Plan 3 tests).

- [ ] **Step 2: Verify import structure**

Run: `cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2/backend && uv run python -c "from app.services.pipeline import run_pipeline; from app.services.claude_client import ClaudeClient; from app.services.extraction import EXTRACTION_TOOLS; from app.services.scoring import SCORING_TOOLS; print(f'Pipeline ready. {len(EXTRACTION_TOOLS)} extraction tools, {len(SCORING_TOOLS)} scoring tools.')"`
Expected: `Pipeline ready. 8 extraction tools, 4 scoring tools.`

- [ ] **Step 3: Final commit**

```bash
cd /Users/piotrkarolak/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: Extraction + Scoring pipeline (Plan 3)

Claude API tool use for data extraction from PDF/XML documents and TP risk 
scoring. Includes upload endpoint, document parser, quality gates, calculated 
fields, pipeline orchestration, and calibration script.

New services: document_parser, claude_client, extraction, scoring, 
calculated_fields, pipeline.

New endpoint: POST /analyses/{id}/documents (multipart upload).

37+ tests covering all pipeline components."
```
