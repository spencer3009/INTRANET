# EduNet - PRD

## Architecture
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI + MongoDB
- 3rd Party: Cloudinary, Firebase Admin SDK (push), pandas, openpyxl, recharts

## Implemented (March 18, 2026)

### Attendance Config by Level - NEW
- [x] UI: Docentes (entry/exit global) + Estudiantes por Nivel (dinámico desde academic_levels)
- [x] DB: attendance_config.teachers + attendance_config.levels[] + tolerance + auto_late
- [x] Backend: PUT /api/settings/attendance (new structure), GET includes config
- [x] QR: auto-marks present/late/absent by student level_id or teacher config
- [x] Backward compatible with old flat format

### Push Notifications (March 18, 2026)
- [x] Firebase Admin SDK, FCM tokens, Service Worker
- [x] Attendance push: entry + exit + tardanza notifications with formatted time
- [x] "Asistencia" tab in NotificationBell for parents

### QR Scanner (March 18, 2026)
- [x] Pauses on scan, "Escanear otro" button, no re-scan

### Support Panel (March 17-18)
- [x] Two-tab renewal, all schools visible, paginated, notification bell

### Subscription (March 2026)
- [x] Real-time state, owner/admin always login, ProfileCard days overdue

## Pending Issues
| P | Issue | Status |
|---|-------|--------|
| P0 | Subject list inconsistency | NOT STARTED |
| P1 | Double scrollbar Registro Auxiliar | NOT STARTED |
| P2 | Hardcoded Owner Dashboard | NOT STARTED |

## Credentials
- Owner: elroble / admin@elroble.edu / 1234abc8
- Support: spencer3009@gmail.com / Socios3009
- Parent: micky@gmail.com / 1234abc8
