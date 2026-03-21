"""
Backward-compatible re-export from register_sync.py.
All logic has moved to services/register_sync.py.
"""
from services.register_sync import (
    sync_exam_to_register,
    sync_single_student,
    retry_pending_syncs,
    sync_to_register,
    sync_single_student_exam,
    sync_single_student_task,
    COLUMN_FIELD_MAP,
    VALID_COLUMNS,
    TASK_VALID_COLUMNS,
    exam_score_to_vigesimal as score_to_vigesimal,
)
