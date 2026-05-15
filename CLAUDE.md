# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

**Backend** (from `backend/` directory):
```powershell
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend**: Serve static HTML files via any HTTP server (e.g., OSPanel's built-in server). The frontend expects the backend at `http://127.0.0.1:8000/api` (hardcoded in `main/api.js`).

**Database**: MySQL. Import schema from `travel_planner(1).sql`. Connection configured in `backend/.env`.

## Architecture

**Stack**: Python FastAPI backend + Vanilla JS/HTML/CSS frontend + MySQL.

**Backend** (`backend/`):
- `main.py` — FastAPI app, CORS config, router registration
- `core/security.py` — JWT (HS256, 7-day expiry) + bcrypt password hashing
- `core/deps.py` — Shared dependency injectors: `get_current_user`, `get_admin_user`, `check_trip_access`
- `models/` — SQLAlchemy ORM models (User, Trip, TripMember, Location, TripItinerary, Task, BudgetItem, Currency, Invitation)
- `schemas/` — Pydantic request/response schemas
- `routers/` — One file per feature domain; each router prefixed under `/api`

**Frontend** (`main/`):
- `api.js` — `ApiClient` class: wraps fetch, injects Bearer token, handles 401→redirect and 403→error
- `main.js` — DOM helpers (`$`, `$$`), UI utilities (counters, tabs, tags, search)
- Feature JS files (`dashboard.js`, `trip.js`, `budget.js`, etc.) import from `api.js` and `main.js`
- No build step — plain ES modules or script tags

**Access control model**:
- Public: `/auth/register`, `/auth/login`, `/api/health`
- Protected: JWT required (enforced via `get_current_user` dependency)
- Trip-scoped: User must have an accepted `TripMember` row (enforced via `check_trip_access`)
- Admin: Role `admin` required (enforced via `get_admin_user`)

**External integrations**:
- 2GIS Maps API — place search, geocoding (`routers/places.py`)
- Currency rates stored in DB relative to RUB; managed via admin panel

**Legacy PHP API** (`api/` directory): partially migrated to Python; Python backend is the active implementation.

## Key Relationships

- A `Trip` has many `TripMember` rows (roles: owner/editor/viewer)
- `Location` + `TripItinerary` model POIs scheduled per trip day
- `BudgetItem` references `Currency`; amounts stored with conversion to base currency
- `Task` has `order_index`, `priority`, and `done_by`/`done_at` tracking
- `Invitation` uses a token with 7-day expiry; accepted invitations create a `TripMember` row
