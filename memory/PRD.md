# EduNet - PRD

## Original Problem Statement
EduNet: Plataforma educativa para colegios peruanos. Full-stack: FastAPI + React + MongoDB.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) | Frontend: React | DB: MongoDB | Images: Cloudinary

## What's Been Implemented

### Session - March 3, 2026 (Latest)
- **CRITICAL BUG FIX: Course Visibility across ALL portals (P0)**: Fixed 8 endpoints that incorrectly used `academic_assignments` or `teacher_assignments` as source of truth for student subjects. All now use `subjects.section_id`. Fixed endpoints: `get_student_profile`, `get_student_courses`, `get_student_tasks`, `get_student_dashboard`, `get_parent_student_courses`, `get_parent_student_tasks`, `get_parent_dashboard`, `get_parent_students` (pending count), `download_material_from_drive` (access validation).
- **DATA MIGRATION**: Migrated 12 old subjects to have correct `section_id` based on `academic_assignments`. Deduplicated empty duplicate subject.
- **Verified consistency**: Student=8, Parent=8, Owner=8, Teacher=3 (only assigned). All portals consistent.

### Previous Session - March 3, 2026
- Photo Upload Modal, Grade Validation, Auto-Grade Creation, Smart Filtering, Subjects-to-Section Refactor

## Prioritized Backlog

### P0
- Verify "Disappearing Student Selection" bug in PaymentFormModal
- Modularize `server.py` into FastAPI routers (CRITICAL tech debt - 22K+ lines)

### P1
- Apply Intelligent Filters to Parents View
- Parent Portal Feature Parity, Matriculas, Notifications, Question Bank

### P2
- Cache Invalidation, Replace window.confirm/alert, Hardcoded Dashboard, Message Center count

## Key Technical Note
**Source of Truth for Student Courses**: `subjects` collection filtered by `section_id`. `academic_assignments` = teacher-to-subject linkage ONLY. Teacher portals correctly use `academic_assignments` to determine which subjects a teacher teaches.

## Test Credentials
- **Support**: spencer3009@gmail.com / 1234abc8
- **Owner (elroble)**: admin@elroble.edu / 1234abc8 / subdomain=elroble
- **Student (Pepito)**: pepito@gmail.com / 1234abc8 / subdomain=elroble
- **Parent (Miguel)**: miguel@gmail.com / 1234abc8 / subdomain=elroble
- **Teacher (Carlos)**: carlos8276@gmail.com / 1234abc8 / subdomain=elroble
