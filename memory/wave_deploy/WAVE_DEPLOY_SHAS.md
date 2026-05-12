# Wave Deployment — Commit SHA Registry

**Created:** 2026-05-12  
**Purpose:** Persistent reference of git commit SHAs needed to restore Ola 2 + Ola 3 features after Ola 1 deploy.

---

## 🔒 SHA al inicio del proceso (HEAD con TODAS las features)

```
0cf7ab4a1d92abe77cfd8e9d38ec6819ece0e429
```

Este commit contiene Ola 1 + Ola 2 + Ola 3. Las copias físicas de los 6 archivos
en este estado están en `/app/memory/wave_deploy/backup_pre_ola1/`.

---

## 🌊 OLA 1 — En deploy (HEAD actual con reverts)

Working dir tiene solo cambios de Ola 1. Los siguientes archivos fueron
revertidos a estados pre-feature:

| Archivo | Revertido a SHA | Feature que se retiró |
|---|---|---|
| `backend/routes/parent_portal.py` | `82bae3ca` | #5 Portal Padre (`student_grades`) — Ola 2 |
| `backend/routes/exams.py` | `1b4bff6d` | #1 Modal Examen dinámico — Ola 3 |
| `backend/services/register_sync.py` | `1b4bff6d` | #1 helpers plantilla dinámica — Ola 3 |
| `frontend/src/pages/CourseDetailPage.jsx` | `ad17c754` | #1 Modal Examen dinámico (frontend) — Ola 3 |
| `frontend/src/components/GradeBookTab.jsx` | `33223be0` | #2 Papelera notas — Ola 3 |
| `frontend/src/utils/registroAuxiliarUtils.js` | `7c5bb12a` | #2 helpers papelera — Ola 3 |

---

## 🌊 OLA 2 — Restaurar parent_portal.py

Tras aprobación de Ola 1 y confirmación de `grades_records` vacía en producción:

```bash
# Restaurar desde respaldo persistente:
cp /app/memory/wave_deploy/backup_pre_ola1/parent_portal.py /app/backend/routes/parent_portal.py

# O alternativamente desde commit original:
cd /app && git checkout 0cf7ab4a -- backend/routes/parent_portal.py
```

**SHA que contiene la versión Ola 2 de parent_portal.py:**
- `2bfc253a` (commit del cambio puntual) o `0cf7ab4a` (HEAD pre-revert, también la tiene)

---

## 🌊 OLA 3 — Restaurar 5 archivos (Exámenes dinámicos + Papelera)

Tras aprobación de Ola 2:

```bash
# Opción A: Desde respaldo persistente
cp /app/memory/wave_deploy/backup_pre_ola1/exams.py /app/backend/routes/exams.py
cp /app/memory/wave_deploy/backup_pre_ola1/register_sync.py /app/backend/services/register_sync.py
cp /app/memory/wave_deploy/backup_pre_ola1/CourseDetailPage.jsx /app/frontend/src/pages/CourseDetailPage.jsx
cp /app/memory/wave_deploy/backup_pre_ola1/GradeBookTab.jsx /app/frontend/src/components/GradeBookTab.jsx
cp /app/memory/wave_deploy/backup_pre_ola1/registroAuxiliarUtils.js /app/frontend/src/utils/registroAuxiliarUtils.js

# Opción B: Desde commit HEAD pre-revert
cd /app && git checkout 0cf7ab4a -- \
  backend/routes/exams.py \
  backend/services/register_sync.py \
  frontend/src/pages/CourseDetailPage.jsx \
  frontend/src/components/GradeBookTab.jsx \
  frontend/src/utils/registroAuxiliarUtils.js
```

**SHAs de feature Ola 3:**
- `8c85b98d` — exams.py + register_sync.py
- `5e2afa01` + `9ebb7961` — CourseDetailPage.jsx
- `dd71da1c` + `f63fa50c` — GradeBookTab.jsx
- `dd71da1c` — registroAuxiliarUtils.js

---

## Verificación rápida

```bash
# Confirmar que el SHA 0cf7ab4a aún existe en historia:
cd /app && git cat-file -t 0cf7ab4a   # debe imprimir "commit"

# Listar respaldos físicos:
ls -la /app/memory/wave_deploy/backup_pre_ola1/
```

---

## ⚠️ Si el SHA 0cf7ab4a se pierde por gc

En el peor caso (improbable, git mantiene reflog 30d), restaurar usando los
respaldos físicos en `/app/memory/wave_deploy/backup_pre_ola1/`.

`HEAD_SHA.txt` dentro de ese directorio también contiene `0cf7ab4a...`.
