# Test Credentials

## Owner / Admin
- Email: `admin@elroble.edu`
- Password: `1234abc8`

## Padre (Apoderado)
- Email: `maria.peres@gmail.com`
- Password: `1234abc8`
- Hijos:
  - `4d30c475-c1cf-42d1-9485-620b556ecf72` — Magno Eduardo Calle Marquez (activo)
  - `d33161f8-8694-45d0-85f8-496b7691c607` — Lucia Demo Pendiente
  - `0840558a-2aab-4510-ac65-d0e764c9fed2` — Diego Demo Rechazado

## Alumno DEMO (reintento/retake habilitado) — creado para test
- Email: `demo.reintento@elroble.edu`
- Password: `Demo1234!`
- Subdomain: `elroble`
- Curso: `Música` (course_id `e04de272-54ec-4af9-868a-bc7604e2b4b4`)
- Examen re-habilitado (cerrado + override activo): `Examen de Música - Unidad 2` (id `DEMO-RETAKE-EXAM`)
- Nota: el override expira 24h. Re-crear con script si caduca.

## Alumno DEMO 2 (para test de auditoría IP compartida)
- Email: `demo.dos@elroble.edu`
- Password: `Demo1234!`
- Subdomain: `elroble`
- id: `DEMO-RETAKE-STUDENT-2` (misma sección que demo.reintento)
- Usado por `tests/test_exam_attempt_audit.py` (ambos rinden DEMO-RETAKE-EXAM desde la misma IP → alerta).

## Profesor sin tutoría
- Email: `sonia3009@gmail.com`
- Password: `teacher123`

## Tutor (profesor + tutor de INICIAL 3 años A)
- Email: `rafa@gmail.com`
- Password: `Tutor123!`  <!-- reset por testing agent en iter_144 (hash anterior fuera de sync) -->

## URLs
- Login: `/login`
- Portal Padre Pagos: `/parent/payments?student_id=<student_id>`

## Soporte / Super Admin global (acceso al panel de soporte)
- Email: `spencer3009@gmail.com`
- Password: `Socios3009`
- Role: `system_admin_global` (accede a `/support/schools`, botón "Probar Push")
