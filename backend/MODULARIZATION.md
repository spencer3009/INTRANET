# Backend Modularization Plan

## Current State
- `server.py`: ~17,651 lines (monolith)
- Endpoints: ~160+ API routes
- Domains: auth, admin, academic, student, teacher, course, messaging, exams, schedules, etc.

## Target Structure

```
/app/backend/
├── server.py              # Main app setup, CORS, includes routers (~200 lines)
├── utils/
│   ├── __init__.py       # ✅ Created
│   ├── config.py         # ✅ Created - DB, JWT, constants
│   └── auth.py           # ✅ Created - Auth helpers, RBAC
├── models/
│   ├── __init__.py
│   ├── user.py           # User Pydantic models
│   ├── academic.py       # Academic models (grades, sections, periods)
│   ├── schedule.py       # Schedule models
│   └── exam.py           # Exam models
└── routes/
    ├── __init__.py
    ├── auth.py           # /api/auth/* (~300 lines)
    ├── users.py          # /api/users/* (~400 lines)
    ├── academic.py       # /api/academic/* (~1500 lines)
    ├── schedules.py      # /api/schedules/*, /api/schedule-settings (~800 lines)
    ├── exams.py          # /api/exams/*, /api/exam-schedules (~1200 lines)
    ├── courses.py        # /api/course/* (~1500 lines)
    ├── messaging.py      # /api/messaging/*, /api/internal-mail/* (~1000 lines)
    ├── student.py        # /api/student/* (~600 lines)
    ├── teacher.py        # /api/teacher/* (~500 lines)
    ├── admin.py          # /api/admin/* (~800 lines)
    ├── settings.py       # /api/settings/* (~200 lines)
    └── integrations.py   # /api/integrations/google-drive/* (~400 lines)
```

## Modularization Steps

### Phase 1: Utils (✅ Complete)
- [x] Create `utils/config.py` - Database, JWT, constants
- [x] Create `utils/auth.py` - Authentication helpers, RBAC functions
- [x] Create `utils/__init__.py` - Exports

### Phase 2: Routes (Pending)
Priority order (most independent to most dependent):

1. **auth.py** - Login, register, verify-email
2. **settings.py** - School settings, cloudinary
3. **schedules.py** - Class schedules, breaks, exam schedules
4. **exams.py** - Exam creation, questions, attempts
5. **academic.py** - Grades, sections, periods, years
6. **users.py** - User CRUD
7. **student.py** - Student portal endpoints
8. **teacher.py** - Teacher portal endpoints
9. **courses.py** - Course posts, tasks, submissions
10. **messaging.py** - Internal mail, messaging
11. **admin.py** - Admin dashboard, reports

### Phase 3: Models (Optional)
Extract Pydantic models to separate files for cleaner organization.

## Implementation Pattern

Each router file should follow this pattern:

```python
# /app/backend/routes/schedules.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from utils import db, get_current_user, is_admin_user

router = APIRouter(prefix="/api", tags=["schedules"])

# Models
class ScheduleCreate(BaseModel):
    # ...

# Endpoints
@router.get("/schedules")
async def get_schedules(current_user = Depends(get_current_user)):
    # ...
```

In `server.py`:
```python
from routes import auth, schedules, exams

app.include_router(auth.router)
app.include_router(schedules.router)
app.include_router(exams.router)
```

## Benefits
- Easier to maintain and debug
- Parallel development possible
- Clearer code organization
- Better testability
- Reduced merge conflicts

## Risks
- Breaking existing functionality during migration
- Import issues between modules
- Database connection sharing

## Testing Strategy
- Migrate one router at a time
- Full API test suite after each migration
- Keep old code commented until tests pass
