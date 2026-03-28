# TP Radar v2 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo, database, FastAPI backend with auth, and React frontend shell — the foundation for the AI analysis pipeline.

**Architecture:** Monorepo with `backend/` (FastAPI + SQLAlchemy async + PostgreSQL) and `frontend/` (React + Vite + TailwindCSS). Docker Compose for local dev. JWT auth. SSE endpoint stub for live progress.

**Tech Stack:**
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (async + asyncpg), Alembic, Pydantic v2, python-jose, passlib[bcrypt]
- Frontend: React 18, TypeScript, Vite 5, TailwindCSS 3, React Router v6
- Dev: Docker Compose (PostgreSQL 16), pytest + httpx, uv (Python package manager)

**Spec reference:** `docs/superpowers/specs/2026-03-28-tp-radar-v2-platform-design.md`

**New repo location:** Create a NEW repository (not in the current tp-radar directory). The current tp-radar repo is reference only.

---

## File Structure

```
tp-radar-v2/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Pydantic Settings (env vars)
│   │   ├── database.py          # async engine, session factory
│   │   ├── models/
│   │   │   ├── __init__.py      # re-export all models
│   │   │   ├── base.py          # DeclarativeBase + UUID mixin
│   │   │   ├── user.py          # User model
│   │   │   ├── company.py       # Company model
│   │   │   ├── analysis.py      # Analysis model
│   │   │   ├── extracted_data.py
│   │   │   ├── report_section.py
│   │   │   ├── risk.py          # RiskAndOpportunity model
│   │   │   └── scoring.py       # Scoring model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py          # Login/Register/Token schemas
│   │   │   ├── company.py
│   │   │   ├── analysis.py
│   │   │   └── report.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py          # POST /auth/register, /auth/login
│   │   │   ├── companies.py     # GET /companies, GET /companies/{slug}
│   │   │   ├── analyses.py      # POST /analyses, GET /analyses/{id}, SSE /analyses/{id}/stream
│   │   │   └── reports.py       # GET /reports/{analysis_id}
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── auth.py          # password hashing, JWT create/verify
│   │   ├── dependencies.py      # get_db, get_current_user
│   │   └── pipeline/
│   │       └── __init__.py      # empty — placeholder for Plan 2
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/            # migration files
│   ├── alembic.ini
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py          # test DB, test client, fixtures
│   │   ├── test_health.py
│   │   ├── test_auth.py
│   │   ├── test_companies.py
│   │   └── test_analyses.py
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx              # Router setup
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── AnalysisProgress.tsx  # stub
│   │   │   └── ReportView.tsx        # stub
│   │   ├── components/
│   │   │   ├── Layout.tsx       # topbar + main area
│   │   │   └── ProtectedRoute.tsx
│   │   ├── lib/
│   │   │   ├── api.ts           # fetch wrapper with JWT
│   │   │   └── auth.tsx         # AuthContext + useAuth hook
│   │   └── index.css            # Tailwind directives
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
├── docker-compose.yml           # PostgreSQL 16
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `tp-radar-v2/` (new repo root)
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/config.py`
- Create: `docker-compose.yml`, `.env.example`, `CLAUDE.md`

- [ ] **Step 1: Create repo and initialize git**

```bash
mkdir -p ~/Claude\ Code/tp-radar-v2
cd ~/Claude\ Code/tp-radar-v2
git init
```

- [ ] **Step 2: Create docker-compose.yml for PostgreSQL**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tpradar
      POSTGRES_PASSWORD: tpradar_dev
      POSTGRES_DB: tpradar
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 3: Create .env.example**

```env
# .env.example
DATABASE_URL=postgresql+asyncpg://tpradar:tpradar_dev@localhost:5432/tpradar
JWT_SECRET=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=http://localhost:5173
```

- [ ] **Step 4: Create backend/pyproject.toml**

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
    "python-jose[cryptography]>=3.3",
    "passlib[bcrypt]>=1.7",
    "python-multipart>=0.0.18",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.25",
    "httpx>=0.28",
    "aiosqlite>=0.21",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 5: Create backend/app/config.py**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://tpradar:tpradar_dev@localhost:5432/tpradar"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours
    allowed_origins: str = "http://localhost:5173"
    # Test mode uses SQLite instead of PostgreSQL
    testing: bool = False

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 6: Create backend/app/main.py with health check**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="TP Radar v2", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
```

- [ ] **Step 7: Create backend/app/__init__.py (empty)**

```python
# backend/app/__init__.py
```

- [ ] **Step 8: Create CLAUDE.md for the new repo**

```markdown
# TP Radar v2

## Project structure
Monorepo: `backend/` (FastAPI + Python) and `frontend/` (React + Vite + TypeScript).

## Running locally
1. `docker compose up -d` — start PostgreSQL
2. `cd backend && uv run uvicorn app.main:app --reload` — start backend on :8000
3. `cd frontend && npm run dev` — start frontend on :5173

## Conventions
- Report content: **Polish** · Code/comments/filenames: **English**
- Backend: FastAPI + SQLAlchemy async + Pydantic v2
- Frontend: React + TypeScript + TailwindCSS
- Tests: pytest (backend), vitest (frontend)
- Package manager: uv (backend), npm (frontend)

## Spec
Full design spec: see tp-radar repo `docs/superpowers/specs/2026-03-28-tp-radar-v2-platform-design.md`
```

- [ ] **Step 9: Install dependencies and verify**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv sync --all-extras
```

Expected: dependencies install without errors.

- [ ] **Step 10: Start PostgreSQL and verify backend starts**

```bash
cd ~/Claude\ Code/tp-radar-v2
docker compose up -d
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/health
# Expected: {"status":"ok","version":"0.1.0"}
kill %1
```

- [ ] **Step 11: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: project scaffolding — FastAPI backend, Docker Compose, config"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/company.py`
- Create: `backend/app/models/analysis.py`
- Create: `backend/app/models/extracted_data.py`
- Create: `backend/app/models/report_section.py`
- Create: `backend/app/models/risk.py`
- Create: `backend/app/models/scoring.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Create backend/app/database.py**

```python
# backend/app/database.py
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Use SQLite for tests, PostgreSQL for dev/prod
if settings.testing:
    engine = create_async_engine(
        "sqlite+aiosqlite:///./test.db",
        echo=False,
    )
else:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=5,
        max_overflow=10,
    )

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session() as session:
        yield session
```

- [ ] **Step 2: Create backend/app/models/base.py — shared base + UUID mixin**

```python
# backend/app/models/base.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 3: Create backend/app/models/user.py**

```python
# backend/app/models/user.py
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin, TimestampMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 4: Create backend/app/models/company.py**

```python
# backend/app/models/company.py
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class Company(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(500))
    krs: Mapped[str | None] = mapped_column(String(20), nullable=True)

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="company")  # noqa: F821
```

- [ ] **Step 5: Create backend/app/models/analysis.py**

```python
# backend/app/models/analysis.py
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class AnalysisPhase(str, enum.Enum):
    SCRAPING = "scraping"
    EXTRACTING = "extracting"
    SCORING = "scoring"
    WRITING = "writing"


class Analysis(UUIDMixin, Base):
    __tablename__ = "analyses"

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus), default=AnalysisStatus.PENDING
    )
    current_phase: Mapped[AnalysisPhase | None] = mapped_column(
        Enum(AnalysisPhase), nullable=True
    )
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    progress_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    financial_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    user_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    company: Mapped["Company"] = relationship(back_populates="analyses")  # noqa: F821
    extracted_data: Mapped["ExtractedData | None"] = relationship(  # noqa: F821
        back_populates="analysis", uselist=False
    )
    report_sections: Mapped[list["ReportSection"]] = relationship(  # noqa: F821
        back_populates="analysis"
    )
    risks_and_opportunities: Mapped[list["RiskAndOpportunity"]] = relationship(  # noqa: F821
        back_populates="analysis"
    )
    scoring: Mapped["Scoring | None"] = relationship(  # noqa: F821
        back_populates="analysis", uselist=False
    )
```

- [ ] **Step 6: Create backend/app/models/extracted_data.py**

```python
# backend/app/models/extracted_data.py
import uuid

from sqlalchemy import ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ExtractedData(Base):
    __tablename__ = "extracted_data"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analyses.id"), primary_key=True
    )
    financials: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    financials_prev: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_structure: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tp_transactions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tax_profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mgmt_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    group_structure: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    online_research: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    insights: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_documents: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    data_gaps: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    analysis: Mapped["Analysis"] = relationship(back_populates="extracted_data")  # noqa: F821
```

- [ ] **Step 7: Create backend/app/models/report_section.py**

```python
# backend/app/models/report_section.py
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class SectionType(str, enum.Enum):
    FIXED = "fixed"
    CUSTOM = "custom"


class ReportSection(UUIDMixin, Base):
    __tablename__ = "report_sections"

    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id"))
    section_key: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(500))
    summary_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    section_type: Mapped[SectionType] = mapped_column(
        Enum(SectionType), default=SectionType.FIXED
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    analysis: Mapped["Analysis"] = relationship(back_populates="report_sections")  # noqa: F821
```

- [ ] **Step 8: Create backend/app/models/risk.py**

```python
# backend/app/models/risk.py
import enum
import uuid

from sqlalchemy import BigInteger, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class RiskType(str, enum.Enum):
    RISK = "risk"
    OPPORTUNITY = "opportunity"


class RiskLevel(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskAndOpportunity(UUIDMixin, Base):
    __tablename__ = "risks_and_opportunities"

    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id"))
    type: Mapped[RiskType] = mapped_column(Enum(RiskType))
    category: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel))
    amount_pln: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    reasoning_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped["Analysis"] = relationship(  # noqa: F821
        back_populates="risks_and_opportunities"
    )
```

- [ ] **Step 9: Create backend/app/models/scoring.py**

```python
# backend/app/models/scoring.py
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OverallLevel(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Scoring(Base):
    __tablename__ = "scoring"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analyses.id"), primary_key=True
    )
    overall_score: Mapped[int] = mapped_column(Integer)
    overall_level: Mapped[OverallLevel] = mapped_column(Enum(OverallLevel))
    justification_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_scores: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    analysis: Mapped["Analysis"] = relationship(back_populates="scoring")  # noqa: F821
```

- [ ] **Step 10: Create backend/app/models/__init__.py — re-export all models**

```python
# backend/app/models/__init__.py
from app.models.base import Base
from app.models.user import User
from app.models.company import Company
from app.models.analysis import Analysis, AnalysisStatus, AnalysisPhase
from app.models.extracted_data import ExtractedData
from app.models.report_section import ReportSection, SectionType
from app.models.risk import RiskAndOpportunity, RiskType, RiskLevel
from app.models.scoring import Scoring, OverallLevel

__all__ = [
    "Base",
    "User",
    "Company",
    "Analysis",
    "AnalysisStatus",
    "AnalysisPhase",
    "ExtractedData",
    "ReportSection",
    "SectionType",
    "RiskAndOpportunity",
    "RiskType",
    "RiskLevel",
    "Scoring",
    "OverallLevel",
]
```

- [ ] **Step 11: Create test fixtures — backend/tests/conftest.py**

```python
# backend/tests/conftest.py
import os

# Set testing mode BEFORE importing app modules
os.environ["TESTING"] = "1"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db
from app.main import app
from app.models import Base


@pytest.fixture
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
```

- [ ] **Step 12: Create backend/tests/__init__.py (empty)**

```python
# backend/tests/__init__.py
```

- [ ] **Step 13: Write model test — backend/tests/test_models.py**

```python
# backend/tests/test_models.py
import uuid

from sqlalchemy import select

from app.models import (
    Analysis,
    AnalysisStatus,
    Company,
    User,
)


async def test_create_user(db_session):
    user = User(
        email="test@pwc.com",
        password_hash="fakehash",
        name="Test User",
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "test@pwc.com"))
    saved = result.scalar_one()
    assert saved.name == "Test User"
    assert isinstance(saved.id, uuid.UUID)


async def test_create_company_with_analysis(db_session):
    company = Company(slug="wb-electronics", name="WB Electronics S.A.", krs="0000369722")
    db_session.add(company)
    await db_session.flush()

    analysis = Analysis(
        company_id=company.id,
        status=AnalysisStatus.PENDING,
        financial_year=2024,
    )
    db_session.add(analysis)
    await db_session.commit()

    result = await db_session.execute(
        select(Analysis).where(Analysis.company_id == company.id)
    )
    saved = result.scalar_one()
    assert saved.status == AnalysisStatus.PENDING
    assert saved.financial_year == 2024
```

- [ ] **Step 14: Run tests**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest tests/test_models.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 15: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: database models — all tables from spec (User, Company, Analysis, etc.)"
```

---

## Task 3: Alembic Migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (auto-generated migration)

- [ ] **Step 1: Initialize Alembic**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run alembic init alembic
```

- [ ] **Step 2: Edit backend/alembic/env.py to use async engine and import models**

Replace the generated `env.py` with:

```python
# backend/alembic/env.py
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 3: Update alembic.ini — remove sqlalchemy.url (we use settings)**

In `backend/alembic.ini`, find the line `sqlalchemy.url = ...` and replace with:

```ini
sqlalchemy.url =
```

(Empty — URL comes from `app.config.settings` in `env.py`.)

- [ ] **Step 4: Generate initial migration**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run alembic revision --autogenerate -m "initial schema"
```

Expected: creates a migration file in `alembic/versions/`.

- [ ] **Step 5: Run migration against local PostgreSQL**

```bash
cd ~/Claude\ Code/tp-radar-v2
docker compose up -d
cd backend
uv run alembic upgrade head
```

Expected: tables created in PostgreSQL.

- [ ] **Step 6: Verify tables exist**

```bash
docker compose exec db psql -U tpradar -d tpradar -c "\dt"
```

Expected: lists tables `users`, `companies`, `analyses`, `extracted_data`, `report_sections`, `risks_and_opportunities`, `scoring`.

- [ ] **Step 7: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: Alembic migrations — initial schema with all tables"
```

---

## Task 4: Auth Service + Endpoints

**Files:**
- Create: `backend/app/services/auth.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/dependencies.py`
- Modify: `backend/app/main.py` (add router)
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing auth test — backend/tests/test_auth.py**

```python
# backend/tests/test_auth.py


async def test_register_user(client):
    response = await client.post(
        "/auth/register",
        json={"email": "test@pwc.com", "password": "securepass123", "name": "Test User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@pwc.com"
    assert "id" in data
    assert "password_hash" not in data


async def test_register_duplicate_email(client):
    payload = {"email": "dup@pwc.com", "password": "securepass123", "name": "User"}
    await client.post("/auth/register", json=payload)
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 409


async def test_login(client):
    await client.post(
        "/auth/register",
        json={"email": "login@pwc.com", "password": "securepass123", "name": "Login User"},
    )
    response = await client.post(
        "/auth/login",
        json={"email": "login@pwc.com", "password": "securepass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client):
    await client.post(
        "/auth/register",
        json={"email": "wrong@pwc.com", "password": "securepass123", "name": "User"},
    )
    response = await client.post(
        "/auth/login",
        json={"email": "wrong@pwc.com", "password": "wrongpass"},
    )
    assert response.status_code == 401


async def test_me_endpoint(client):
    await client.post(
        "/auth/register",
        json={"email": "me@pwc.com", "password": "securepass123", "name": "Me User"},
    )
    login = await client.post(
        "/auth/login",
        json={"email": "me@pwc.com", "password": "securepass123"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "me@pwc.com"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest tests/test_auth.py -v
```

Expected: FAIL (404 — routes don't exist yet).

- [ ] **Step 3: Create backend/app/services/__init__.py (empty) and backend/app/services/auth.py**

```python
# backend/app/services/auth.py
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Returns user_id or None if token is invalid."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None
```

- [ ] **Step 4: Create backend/app/schemas/__init__.py (empty) and backend/app/schemas/auth.py**

```python
# backend/app/schemas/auth.py
import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 5: Create backend/app/dependencies.py**

```python
# backend/app/dependencies.py
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.auth import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

- [ ] **Step 6: Create backend/app/routers/__init__.py (empty) and backend/app/routers/auth.py**

```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 7: Register router in backend/app/main.py**

Add to `main.py` after CORS middleware:

```python
from app.routers import auth

app.include_router(auth.router)
```

- [ ] **Step 8: Run auth tests**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest tests/test_auth.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: auth — register, login, JWT, /me endpoint with tests"
```

---

## Task 5: Company + Analysis API Endpoints

**Files:**
- Create: `backend/app/schemas/company.py`
- Create: `backend/app/schemas/analysis.py`
- Create: `backend/app/routers/companies.py`
- Create: `backend/app/routers/analyses.py`
- Modify: `backend/app/main.py` (add routers)
- Create: `backend/tests/test_companies.py`
- Create: `backend/tests/test_analyses.py`

- [ ] **Step 1: Write failing company tests — backend/tests/test_companies.py**

```python
# backend/tests/test_companies.py
from tests.helpers import register_and_login


async def test_list_companies_empty(client):
    token = await register_and_login(client)
    response = await client.get(
        "/companies", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_list_companies_after_analysis(client):
    """Companies are created via the analysis flow, not standalone."""
    token = await register_and_login(client)

    # Create analysis (which auto-creates company)
    response = await client.post(
        "/analyses",
        json={"company_name": "WB Electronics S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201

    response = await client.get(
        "/companies", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 1
    assert companies[0]["slug"] == "wb-electronics"
```

- [ ] **Step 2: Write failing analysis tests — backend/tests/test_analyses.py**

```python
# backend/tests/test_analyses.py
from tests.helpers import register_and_login


async def test_create_analysis(client):
    token = await register_and_login(client)
    response = await client.post(
        "/analyses",
        json={"company_name": "WB Electronics S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["company"]["slug"] == "wb-electronics"
    assert "id" in data


async def test_create_analysis_with_user_prompt(client):
    token = await register_and_login(client)
    response = await client.post(
        "/analyses",
        json={
            "company_name": "Orange Polska S.A.",
            "user_prompt": "Sprawdź cash pooling i IP Box",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["user_prompt"] == "Sprawdź cash pooling i IP Box"


async def test_get_analysis(client):
    token = await register_and_login(client)
    create = await client.post(
        "/analyses",
        json={"company_name": "HAVI Service Hub Sp. z o.o."},
        headers={"Authorization": f"Bearer {token}"},
    )
    analysis_id = create.json()["id"]

    response = await client.get(
        f"/analyses/{analysis_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["id"] == analysis_id


async def test_list_analyses(client):
    token = await register_and_login(client)
    await client.post(
        "/analyses",
        json={"company_name": "WB Electronics S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/analyses",
        json={"company_name": "Orange Polska S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = await client.get(
        "/analyses", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_sse_stream_stub(client):
    token = await register_and_login(client)
    create = await client.post(
        "/analyses",
        json={"company_name": "Test S.A."},
        headers={"Authorization": f"Bearer {token}"},
    )
    analysis_id = create.json()["id"]

    response = await client.get(
        f"/analyses/{analysis_id}/stream",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
```

- [ ] **Step 3: Create test helper — backend/tests/helpers.py**

```python
# backend/tests/helpers.py
from httpx import AsyncClient


async def register_and_login(client: AsyncClient, email: str = "test@pwc.com") -> str:
    """Register a user and return JWT token."""
    await client.post(
        "/auth/register",
        json={"email": email, "password": "securepass123", "name": "Test User"},
    )
    response = await client.post(
        "/auth/login",
        json={"email": email, "password": "securepass123"},
    )
    return response.json()["access_token"]
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest tests/test_companies.py tests/test_analyses.py -v
```

Expected: FAIL (404 — routes don't exist).

- [ ] **Step 5: Create backend/app/schemas/company.py**

```python
# backend/app/schemas/company.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class CompanyResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    krs: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Create backend/app/schemas/analysis.py**

```python
# backend/app/schemas/analysis.py
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.company import CompanyResponse


class CreateAnalysisRequest(BaseModel):
    company_name: str
    user_prompt: str | None = None


class AnalysisResponse(BaseModel):
    id: uuid.UUID
    status: str
    current_phase: str | None
    progress_pct: int
    progress_message: str | None
    financial_year: int | None
    user_prompt: str | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    company: CompanyResponse

    model_config = {"from_attributes": True}
```

- [ ] **Step 7: Create slug utility — backend/app/utils.py**

```python
# backend/app/utils.py
import re


def company_name_to_slug(name: str) -> str:
    """Convert company name to slug. Remove legal suffixes, lowercase, hyphens."""
    # Remove common Polish legal suffixes
    suffixes = [
        r"\bS\.A\.\b", r"\bSp\.\s*z\s*o\.o\.\b", r"\bS\.K\.A\.\b",
        r"\bS\.K\.\b", r"\bsp\.\s*j\.\b", r"\bsp\.\s*k\.\b",
    ]
    slug = name
    for suffix in suffixes:
        slug = re.sub(suffix, "", slug, flags=re.IGNORECASE)
    # Lowercase, strip, replace spaces/special chars with hyphens
    slug = slug.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug
```

- [ ] **Step 8: Create backend/app/routers/companies.py**

```python
# backend/app/routers/companies.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Company, User
from app.schemas.company import CompanyResponse

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return result.scalars().all()
```

- [ ] **Step 9: Create backend/app/routers/analyses.py (with SSE stub)**

```python
# backend/app/routers/analyses.py
import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Analysis, AnalysisStatus, Company, User
from app.schemas.analysis import AnalysisResponse, CreateAnalysisRequest
from app.utils import company_name_to_slug

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.post("", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    body: CreateAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = company_name_to_slug(body.company_name)

    # Find or create company
    result = await db.execute(select(Company).where(Company.slug == slug))
    company = result.scalar_one_or_none()
    if not company:
        company = Company(slug=slug, name=body.company_name)
        db.add(company)
        await db.flush()

    analysis = Analysis(
        company_id=company.id,
        user_id=current_user.id,
        status=AnalysisStatus.PENDING,
        user_prompt=body.user_prompt,
    )
    db.add(analysis)
    await db.commit()

    # Reload with company relationship
    result = await db.execute(
        select(Analysis).options(joinedload(Analysis.company)).where(Analysis.id == analysis.id)
    )
    return result.scalar_one()


@router.get("", response_model=list[AnalysisResponse])
async def list_analyses(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis)
        .options(joinedload(Analysis.company))
        .order_by(Analysis.created_at.desc())
    )
    return result.scalars().unique().all()


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis)
        .options(joinedload(Analysis.company))
        .where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.get("/{analysis_id}/stream")
async def stream_progress(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """SSE endpoint stub. In Plan 2+, this will stream real pipeline progress."""
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_stream():
        yield f"data: {{\"status\": \"{analysis.status}\", \"progress_pct\": {analysis.progress_pct}}}\n\n"
        # In production, this will poll DB or use pub/sub for real-time updates
        await asyncio.sleep(0)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 10: Register new routers in backend/app/main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, companies, analyses

app = FastAPI(title="TP Radar v2", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(analyses.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
```

- [ ] **Step 11: Run all tests**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest -v
```

Expected: all tests PASS (models + auth + companies + analyses).

- [ ] **Step 12: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: company + analysis API — CRUD, SSE stub, slug generation"
```

---

## Task 6: Report Endpoint

**Files:**
- Create: `backend/app/schemas/report.py`
- Create: `backend/app/routers/reports.py`
- Modify: `backend/app/main.py` (add router)
- Create: `backend/tests/test_reports.py`

- [ ] **Step 1: Write failing report test — backend/tests/test_reports.py**

```python
# backend/tests/test_reports.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Analysis,
    AnalysisStatus,
    Company,
    OverallLevel,
    ReportSection,
    RiskAndOpportunity,
    RiskLevel,
    RiskType,
    Scoring,
    SectionType,
)
from tests.helpers import register_and_login


async def _seed_report(db: AsyncSession) -> uuid.UUID:
    """Create a company + analysis + report sections + scoring for testing."""
    company = Company(slug="test-co", name="Test Co S.A.")
    db.add(company)
    await db.flush()

    analysis = Analysis(
        company_id=company.id, status=AnalysisStatus.DONE, financial_year=2024
    )
    db.add(analysis)
    await db.flush()

    db.add(
        ReportSection(
            analysis_id=analysis.id,
            section_key="executive",
            title="Executive Summary",
            summary_md="Short summary.",
            full_md="Full detailed executive summary with analysis.",
            section_type=SectionType.FIXED,
            display_order=0,
        )
    )
    db.add(
        ReportSection(
            analysis_id=analysis.id,
            section_key="tp_risks",
            title="Ryzyka Transfer Pricing",
            summary_md="TP summary.",
            full_md="Full TP analysis.",
            section_type=SectionType.FIXED,
            display_order=1,
        )
    )
    db.add(
        RiskAndOpportunity(
            analysis_id=analysis.id,
            type=RiskType.RISK,
            category="tp",
            name="Cash pooling",
            description="High risk cash pooling",
            level=RiskLevel.HIGH,
            amount_pln=54_000_000,
            reasoning_md="The implied rate is above market.",
        )
    )
    db.add(
        Scoring(
            analysis_id=analysis.id,
            overall_score=8,
            overall_level=OverallLevel.HIGH,
            justification_md="Multiple high-risk TP transactions.",
            category_scores={"tp": 8, "tax": 5},
        )
    )
    await db.commit()
    return analysis.id


async def test_get_report(client, db_session):
    analysis_id = await _seed_report(db_session)
    token = await register_and_login(client)

    response = await client.get(
        f"/reports/{analysis_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["sections"]) == 2
    assert data["scoring"]["overall_score"] == 8
    assert len(data["risks_and_opportunities"]) == 1


async def test_get_report_not_found(client):
    token = await register_and_login(client)
    fake_id = uuid.uuid4()
    response = await client.get(
        f"/reports/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest tests/test_reports.py -v
```

Expected: FAIL (404 — route doesn't exist).

- [ ] **Step 3: Create backend/app/schemas/report.py**

```python
# backend/app/schemas/report.py
import uuid

from pydantic import BaseModel


class ReportSectionResponse(BaseModel):
    id: uuid.UUID
    section_key: str
    title: str
    summary_md: str | None
    full_md: str | None
    section_type: str
    display_order: int

    model_config = {"from_attributes": True}


class RiskResponse(BaseModel):
    id: uuid.UUID
    type: str
    category: str
    name: str
    description: str
    level: str
    amount_pln: int | None
    reasoning_md: str | None

    model_config = {"from_attributes": True}


class ScoringResponse(BaseModel):
    overall_score: int
    overall_level: str
    justification_md: str | None
    category_scores: dict | None

    model_config = {"from_attributes": True}


class ReportResponse(BaseModel):
    analysis_id: uuid.UUID
    sections: list[ReportSectionResponse]
    risks_and_opportunities: list[RiskResponse]
    scoring: ScoringResponse | None
```

- [ ] **Step 4: Create backend/app/routers/reports.py**

```python
# backend/app/routers/reports.py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Analysis, ReportSection, RiskAndOpportunity, Scoring, User
from app.schemas.report import ReportResponse, ReportSectionResponse, RiskResponse, ScoringResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{analysis_id}", response_model=ReportResponse)
async def get_report(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Check analysis exists
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Fetch sections
    sections_result = await db.execute(
        select(ReportSection)
        .where(ReportSection.analysis_id == analysis_id)
        .order_by(ReportSection.display_order)
    )
    sections = sections_result.scalars().all()

    # Fetch risks
    risks_result = await db.execute(
        select(RiskAndOpportunity).where(RiskAndOpportunity.analysis_id == analysis_id)
    )
    risks = risks_result.scalars().all()

    # Fetch scoring
    scoring_result = await db.execute(
        select(Scoring).where(Scoring.analysis_id == analysis_id)
    )
    scoring = scoring_result.scalar_one_or_none()

    return ReportResponse(
        analysis_id=analysis_id,
        sections=[ReportSectionResponse.model_validate(s) for s in sections],
        risks_and_opportunities=[RiskResponse.model_validate(r) for r in risks],
        scoring=ScoringResponse.model_validate(scoring) if scoring else None,
    )
```

- [ ] **Step 5: Register router in main.py**

Add to imports and include:

```python
from app.routers import auth, companies, analyses, reports

# ... existing code ...
app.include_router(reports.router)
```

- [ ] **Step 6: Run all tests**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: report endpoint — sections, risks, scoring as JSON"
```

---

## Task 7: Frontend Scaffolding

**Files:**
- Create: `frontend/` (via Vite)
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/AnalysisProgress.tsx`
- Create: `frontend/src/pages/ReportView.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create Vite React TypeScript project**

```bash
cd ~/Claude\ Code/tp-radar-v2
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd ~/Claude\ Code/tp-radar-v2/frontend
npm install react-router-dom react-markdown
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind — update frontend/vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

- [ ] **Step 4: Set up Tailwind in frontend/src/index.css**

Replace contents with:

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

- [ ] **Step 5: Create frontend/src/lib/api.ts — fetch wrapper**

```typescript
// frontend/src/lib/api.ts
const BASE_URL = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.detail || "Request failed");
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export { ApiError };
```

- [ ] **Step 6: Create frontend/src/lib/auth.tsx — auth context**

```tsx
// frontend/src/lib/auth.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api
        .get<User>("/auth/me")
        .then(setUser)
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { access_token } = await api.post<{ access_token: string }>(
      "/auth/login",
      { email, password },
    );
    localStorage.setItem("token", access_token);
    const me = await api.get<User>("/auth/me");
    setUser(me);
  };

  const register = async (email: string, password: string, name: string) => {
    await api.post("/auth/register", { email, password, name });
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 7: Create frontend/src/components/ProtectedRoute.tsx**

```tsx
// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 8: Create frontend/src/components/Layout.tsx**

```tsx
// frontend/src/components/Layout.tsx
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            TP Radar
          </Link>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-neutral-400">{user.email}</span>
              <button
                onClick={logout}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Wyloguj
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Create page stubs**

```tsx
// frontend/src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Nieprawidłowy email lub hasło");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">TP Radar</h1>
        {error && (
          <p className="text-red-600 text-sm text-center">{error}</p>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <input
          type="password"
          placeholder="Hasło"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="submit"
          className="w-full py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Zaloguj się
        </button>
      </form>
    </div>
  );
}
```

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Analysis {
  id: string;
  status: string;
  company: { slug: string; name: string };
  created_at: string;
}

export function Dashboard() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  useEffect(() => {
    api.get<Analysis[]>("/analyses").then(setAnalyses);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      {analyses.length === 0 ? (
        <p className="text-neutral-500">Brak analiz. Uruchom pierwszą analizę.</p>
      ) : (
        <div className="grid gap-4">
          {analyses.map((a) => (
            <div
              key={a.id}
              className="p-4 bg-white rounded-lg border border-neutral-200"
            >
              <p className="font-medium">{a.company.name}</p>
              <p className="text-sm text-neutral-500">
                {a.status} &middot; {new Date(a.created_at).toLocaleDateString("pl")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// frontend/src/pages/AnalysisProgress.tsx
export function AnalysisProgress() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Analiza w toku</h1>
      <p className="text-neutral-500">Stub — will show live progress in Plan 2+.</p>
    </div>
  );
}
```

```tsx
// frontend/src/pages/ReportView.tsx
export function ReportView() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Raport</h1>
      <p className="text-neutral-500">Stub — will render full report in Plan 5.</p>
    </div>
  );
}
```

- [ ] **Step 10: Wire up routing in frontend/src/App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AnalysisProgress } from "./pages/AnalysisProgress";
import { ReportView } from "./pages/ReportView";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyze/:id" element={<AnalysisProgress />} />
            <Route path="/report/:id" element={<ReportView />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 11: Update frontend/src/main.tsx (clean Vite boilerplate)**

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 12: Delete Vite boilerplate files**

```bash
cd ~/Claude\ Code/tp-radar-v2/frontend
rm -f src/App.css src/assets/react.svg public/vite.svg
```

- [ ] **Step 13: Verify frontend builds and starts**

```bash
cd ~/Claude\ Code/tp-radar-v2/frontend
npm run build
npm run dev &
sleep 3
curl -s http://localhost:5173 | head -5
# Expected: HTML with <div id="root">
kill %1
```

- [ ] **Step 14: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "feat: frontend scaffolding — React + Vite + Tailwind, auth, routing, page stubs"
```

---

## Task 8: End-to-End Integration Test

**Files:**
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write integration test**

```python
# backend/tests/test_integration.py
"""End-to-end test: register → login → create analysis → get analysis → list."""
from tests.helpers import register_and_login


async def test_full_flow(client):
    # Register + login
    token = await register_and_login(client, email="e2e@pwc.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Verify user
    me = await client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "e2e@pwc.com"

    # No companies yet
    companies = await client.get("/companies", headers=headers)
    assert companies.json() == []

    # Create analysis
    create = await client.post(
        "/analyses",
        json={
            "company_name": "WB Electronics S.A.",
            "user_prompt": "Sprawdź gwarancje wewnątrzgrupowe",
        },
        headers=headers,
    )
    assert create.status_code == 201
    analysis = create.json()
    assert analysis["status"] == "pending"
    assert analysis["company"]["slug"] == "wb-electronics"
    assert analysis["user_prompt"] == "Sprawdź gwarancje wewnątrzgrupowe"
    analysis_id = analysis["id"]

    # Company auto-created
    companies = await client.get("/companies", headers=headers)
    assert len(companies.json()) == 1

    # Get analysis by ID
    detail = await client.get(f"/analyses/{analysis_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["id"] == analysis_id

    # List analyses
    listing = await client.get("/analyses", headers=headers)
    assert len(listing.json()) == 1

    # SSE stream stub
    stream = await client.get(f"/analyses/{analysis_id}/stream", headers=headers)
    assert stream.status_code == 200
    assert "text/event-stream" in stream.headers["content-type"]

    # Report not available yet (no report sections)
    report = await client.get(f"/reports/{analysis_id}", headers=headers)
    assert report.status_code == 200
    assert report.json()["sections"] == []
    assert report.json()["scoring"] is None
```

- [ ] **Step 2: Run all tests**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
uv run pytest -v
```

Expected: all tests PASS (models + auth + companies + analyses + reports + integration).

- [ ] **Step 3: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "test: end-to-end integration test — full user flow"
```

---

## Task 9: Dockerfile + README

**Files:**
- Create: `backend/Dockerfile`
- Create: `README.md`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first (layer caching)
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# Copy app code
COPY . .
RUN uv sync --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create README.md**

```markdown
# TP Radar v2

AI-powered company analysis platform for tax risk assessment.

## Quick Start

```bash
# Start PostgreSQL
docker compose up -d

# Backend
cd backend
cp ../.env.example ../.env  # edit with your values
uv sync --all-extras
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Architecture

See `docs/` in the tp-radar repo for full spec and design documents.

- **Backend:** FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend:** React + Vite + TailwindCSS
- **AI Pipeline:** Claude API (Anthropic) — coming in Plan 2+
```

- [ ] **Step 3: Verify Docker build works**

```bash
cd ~/Claude\ Code/tp-radar-v2/backend
docker build -t tp-radar-v2-backend .
```

Expected: image builds successfully.

- [ ] **Step 4: Commit**

```bash
cd ~/Claude\ Code/tp-radar-v2
git add -A
git commit -m "chore: Dockerfile + README"
```

---

## Task 10: Create GitHub Repository

- [ ] **Step 1: Create remote repo and push**

```bash
cd ~/Claude\ Code/tp-radar-v2
gh repo create tp-radar-v2 --private --source=. --push
```

Expected: repo created, all commits pushed.

---

## Summary — What Plan 1 Delivers

After completing all tasks:

- **Working backend** with FastAPI, PostgreSQL, auth (register/login/JWT), company + analysis CRUD, report endpoint, SSE stub
- **Working frontend** with React, Tailwind, auth flow, routing to dashboard + stubs for progress/report views
- **Database** with full schema from spec (all 7 tables), Alembic migrations
- **Tests** covering models, auth, all endpoints, and end-to-end flow
- **Docker** Compose for local dev, Dockerfile for backend
- **GitHub repo** ready for Plan 2

**Next plans (revised after design review 2026-03-28):**
- **Plan 2:** UI Lite — dashboard with mock data (from v1), report view with hardcoded data
- **Plan 3:** Extraction + Scoring — Claude API prompts for Phase 2 + Phase 3, calibration
- **Plan 4:** Report Generation — Phase 4 (writer + 1 reviewer), connect to UI
- **Plan 5:** Scraping — Phase 1 (Playwright + pdfplumber + OCR), PDF upload fallback
- **Plan 6:** Full UI + Deployment — complete frontend, Railway + Cloudflare Pages
