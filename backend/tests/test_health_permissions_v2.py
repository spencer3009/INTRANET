"""
Test Health & Wellness Permission Logic v2
NEW RULE: 
- Owner: always full access
- Admin/Teacher: ALWAYS can READ (GET endpoints)
- Admin/Teacher: can CREATE/EDIT/DELETE only if their switch is ON
- Sidebar always visible for admin/teacher
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OWNER_CREDS = {"email": "admin@elroble.edu", "password": "1234abc8", "subdomain": "elroble"}
TEACHER_CREDS = {"email": "sonia3009@gmail.com", "password": "Test1234!", "subdomain": "elroble"}


class TestHealthPermissionsV2:
    """Test the new health permissions logic where READ is always allowed"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for owner and teacher"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as owner
        owner_resp = self.session.post(f"{BASE_URL}/api/auth/login", json=OWNER_CREDS)
        assert owner_resp.status_code == 200, f"Owner login failed: {owner_resp.text}"
        self.owner_token = owner_resp.json().get("token")
        
        # Login as teacher
        teacher_resp = self.session.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        assert teacher_resp.status_code == 200, f"Teacher login failed: {teacher_resp.text}"
        self.teacher_token = teacher_resp.json().get("token")
        
        yield
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # PERMISSION SETTINGS TESTS
    # ═══════════════════════════════════════════════════════════════════════════════
    
    def test_get_health_permissions_owner(self):
        """Owner can read health permissions"""
        resp = self.session.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"PASS: Owner can read permissions: {data}")
    
    def test_get_health_permissions_teacher(self):
        """Teacher can read health permissions (any authenticated user can)"""
        resp = self.session.get(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "admin_can_manage" in data
        assert "teacher_can_manage" in data
        print(f"PASS: Teacher can read permissions: {data}")
    
    def test_update_health_permissions_owner(self):
        """Owner can update health permissions"""
        resp = self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False}
        )
        assert resp.status_code == 200
        print("PASS: Owner can update permissions")
    
    def test_update_health_permissions_teacher_denied(self):
        """Teacher cannot update health permissions (403)"""
        resp = self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={"teacher_can_manage": True}
        )
        assert resp.status_code == 403
        print("PASS: Teacher cannot update permissions (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # TEACHER READ ACCESS TESTS (teacher_can_manage=false)
    # ═══════════════════════════════════════════════════════════════════════════════
    
    def test_teacher_can_get_topico_when_switch_off(self):
        """Teacher can GET /api/health/topico when teacher_can_manage=false (READ always allowed)"""
        # First ensure teacher_can_manage is false
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False}
        )
        
        # Teacher should still be able to GET
        resp = self.session.get(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "records" in data
        print(f"PASS: Teacher can GET topico when switch off - {len(data.get('records', []))} records")
    
    def test_teacher_can_get_psicologia_when_switch_off(self):
        """Teacher can GET /api/health/psicologia when teacher_can_manage=false"""
        # Ensure teacher_can_manage is false
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False}
        )
        
        resp = self.session.get(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.teacher_token}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "records" in data
        print(f"PASS: Teacher can GET psicologia when switch off - {len(data.get('records', []))} records")
    
    def test_teacher_cannot_post_topico_when_switch_off(self):
        """Teacher cannot POST /api/health/topico when teacher_can_manage=false (403)"""
        # Ensure teacher_can_manage is false
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False}
        )
        
        # Teacher should NOT be able to POST
        resp = self.session.post(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={
                "student_id": "test-student-id",
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "incident_type": "dolor",
                "description": "Test description",
                "action_taken": "Test action",
                "status": "atendido",
                "responsible": "Test Responsible"
            }
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "permisos" in data.get("detail", "").lower() or "contacta" in data.get("detail", "").lower()
        print(f"PASS: Teacher cannot POST topico when switch off (403): {data.get('detail')}")
    
    def test_teacher_cannot_post_psicologia_when_switch_off(self):
        """Teacher cannot POST /api/health/psicologia when teacher_can_manage=false (403)"""
        # Ensure teacher_can_manage is false
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False}
        )
        
        resp = self.session.post(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={
                "student_id": "test-student-id",
                "student_name": "Test Student",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "record_type": "conductual",
                "reason": "Test reason",
                "professional_observation": "Test observation",
                "alert_level": "bajo",
                "requires_followup": False,
                "status": "en_seguimiento",
                "responsible": "Test Responsible"
            }
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Teacher cannot POST psicologia when switch off (403)")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # TEACHER WRITE ACCESS TESTS (teacher_can_manage=true)
    # ═══════════════════════════════════════════════════════════════════════════════
    
    def test_teacher_can_post_topico_when_switch_on(self):
        """Teacher CAN POST /api/health/topico when teacher_can_manage=true"""
        # Enable teacher_can_manage
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": True}
        )
        
        # Teacher should be able to POST
        resp = self.session.post(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={
                "student_id": "test-student-id-write",
                "student_name": "Test Student Write",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "incident_type": "dolor",
                "description": "Test description for write test",
                "action_taken": "Test action",
                "status": "atendido",
                "responsible": "Test Responsible"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "record" in data
        print(f"PASS: Teacher CAN POST topico when switch on - record id: {data.get('record', {}).get('id')}")
        
        # Cleanup: delete the test record
        record_id = data.get("record", {}).get("id")
        if record_id:
            self.session.delete(
                f"{BASE_URL}/api/health/topico/{record_id}",
                headers={"Authorization": f"Bearer {self.teacher_token}"}
            )
    
    def test_teacher_can_post_psicologia_when_switch_on(self):
        """Teacher CAN POST /api/health/psicologia when teacher_can_manage=true"""
        # Enable teacher_can_manage
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": True}
        )
        
        resp = self.session.post(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.teacher_token}"},
            json={
                "student_id": "test-student-id-write",
                "student_name": "Test Student Write",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "record_type": "conductual",
                "reason": "Test reason for write test",
                "professional_observation": "Test observation",
                "alert_level": "bajo",
                "requires_followup": False,
                "status": "en_seguimiento",
                "responsible": "Test Responsible"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "record" in data
        print(f"PASS: Teacher CAN POST psicologia when switch on - record id: {data.get('record', {}).get('id')}")
        
        # Cleanup
        record_id = data.get("record", {}).get("id")
        if record_id:
            self.session.delete(
                f"{BASE_URL}/api/health/psicologia/{record_id}",
                headers={"Authorization": f"Bearer {self.teacher_token}"}
            )
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # OWNER ALWAYS HAS ACCESS TESTS
    # ═══════════════════════════════════════════════════════════════════════════════
    
    def test_owner_can_post_topico_regardless_of_switches(self):
        """Owner always can POST regardless of switches"""
        # Disable all switches
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False, "admin_can_manage": False}
        )
        
        # Owner should still be able to POST
        resp = self.session.post(
            f"{BASE_URL}/api/health/topico",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "student_id": "test-student-owner",
                "student_name": "Test Student Owner",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "incident_type": "dolor",
                "description": "Owner test description",
                "action_taken": "Owner test action",
                "status": "atendido",
                "responsible": "Owner"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "record" in data
        print(f"PASS: Owner can POST topico regardless of switches - record id: {data.get('record', {}).get('id')}")
        
        # Cleanup
        record_id = data.get("record", {}).get("id")
        if record_id:
            self.session.delete(
                f"{BASE_URL}/api/health/topico/{record_id}",
                headers={"Authorization": f"Bearer {self.owner_token}"}
            )
    
    def test_owner_can_post_psicologia_regardless_of_switches(self):
        """Owner always can POST psicologia regardless of switches"""
        # Disable all switches
        self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False, "admin_can_manage": False}
        )
        
        resp = self.session.post(
            f"{BASE_URL}/api/health/psicologia",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "student_id": "test-student-owner",
                "student_name": "Test Student Owner",
                "grade_id": "test-grade",
                "grade_name": "Test Grade",
                "section_id": "test-section",
                "section_name": "Test Section",
                "date": "2026-01-15",
                "time": "10:00",
                "record_type": "conductual",
                "reason": "Owner test reason",
                "professional_observation": "Owner observation",
                "alert_level": "bajo",
                "requires_followup": False,
                "status": "en_seguimiento",
                "responsible": "Owner"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: Owner can POST psicologia regardless of switches")
        
        # Cleanup
        record_id = resp.json().get("record", {}).get("id")
        if record_id:
            self.session.delete(
                f"{BASE_URL}/api/health/psicologia/{record_id}",
                headers={"Authorization": f"Bearer {self.owner_token}"}
            )
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # CLEANUP - Reset permissions to default state
    # ═══════════════════════════════════════════════════════════════════════════════
    
    def test_z_cleanup_reset_permissions(self):
        """Reset permissions to default state after tests"""
        resp = self.session.put(
            f"{BASE_URL}/api/settings/health-permissions",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"teacher_can_manage": False, "admin_can_manage": True}
        )
        assert resp.status_code == 200
        print("PASS: Permissions reset to default (teacher_can_manage=false, admin_can_manage=true)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
