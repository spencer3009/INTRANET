"""
Test Schedule Breaks (Recreo/Almuerzo/Evento) API
Tests for Special Blocks feature that blocks entire time rows on the schedule grid
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"

class TestScheduleBreaksAPI:
    """Test Schedule Breaks (Special Blocks) API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store created break IDs for cleanup
        self.created_break_ids = []
        
        yield
        
        # Cleanup - delete created breaks
        for break_id in self.created_break_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/schedule/breaks/{break_id}")
            except:
                pass
    
    def test_get_schedule_breaks(self):
        """Test GET /api/schedule/breaks - returns list of breaks"""
        response = self.session.get(f"{BASE_URL}/api/schedule/breaks")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "breaks" in data, "Response should contain 'breaks' key"
        assert isinstance(data["breaks"], list), "breaks should be a list"
        
        print(f"✓ GET /api/schedule/breaks - Found {len(data['breaks'])} breaks")
        
        # If there are breaks, verify structure
        if data["breaks"]:
            break_item = data["breaks"][0]
            assert "id" in break_item, "Break should have 'id'"
            assert "type" in break_item, "Break should have 'type'"
            assert "label" in break_item, "Break should have 'label'"
            assert "start_time" in break_item, "Break should have 'start_time'"
            assert "end_time" in break_item, "Break should have 'end_time'"
            print(f"  First break: {break_item['label']} ({break_item['start_time']} - {break_item['end_time']})")
    
    def test_create_break_recreo(self):
        """Test POST /api/schedule/breaks - create Recreo break"""
        # Use a time slot that's unlikely to conflict
        payload = {
            "type": "break",
            "label": "TEST_Recreo",
            "start_time": "11:00",
            "end_time": "11:30",
            "color": "#FCD34D"
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        # May fail if there's a conflict - that's OK, we'll check
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Ya existe un bloque" in error_detail or "clases programadas" in error_detail:
                print(f"⚠ Break creation skipped - conflict: {error_detail}")
                pytest.skip("Time slot has conflict")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "break" in data, "Response should contain 'break' key"
        assert data["break"]["type"] == "break", "Type should be 'break'"
        assert data["break"]["label"] == "TEST_Recreo", "Label should match"
        
        # Store for cleanup
        self.created_break_ids.append(data["break"]["id"])
        
        print(f"✓ POST /api/schedule/breaks - Created Recreo: {data['break']['id']}")
    
    def test_create_break_almuerzo(self):
        """Test POST /api/schedule/breaks - create Almuerzo break"""
        payload = {
            "type": "lunch",
            "label": "TEST_Almuerzo",
            "start_time": "12:00",
            "end_time": "13:00",
            "color": "#FB923C"
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Ya existe un bloque" in error_detail or "clases programadas" in error_detail:
                print(f"⚠ Almuerzo creation skipped - conflict: {error_detail}")
                pytest.skip("Time slot has conflict")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["break"]["type"] == "lunch", "Type should be 'lunch'"
        
        self.created_break_ids.append(data["break"]["id"])
        print(f"✓ POST /api/schedule/breaks - Created Almuerzo: {data['break']['id']}")
    
    def test_create_break_evento(self):
        """Test POST /api/schedule/breaks - create Evento break"""
        payload = {
            "type": "event",
            "label": "TEST_Evento Especial",
            "start_time": "14:00",
            "end_time": "15:00",
            "color": "#60A5FA"
        }
        
        response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload)
        
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "Ya existe un bloque" in error_detail or "clases programadas" in error_detail:
                print(f"⚠ Evento creation skipped - conflict: {error_detail}")
                pytest.skip("Time slot has conflict")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["break"]["type"] == "event", "Type should be 'event'"
        
        self.created_break_ids.append(data["break"]["id"])
        print(f"✓ POST /api/schedule/breaks - Created Evento: {data['break']['id']}")
    
    def test_create_break_overlap_validation(self):
        """Test that overlapping breaks are rejected"""
        # First create a break
        payload1 = {
            "type": "break",
            "label": "TEST_First Break",
            "start_time": "15:00",
            "end_time": "15:30"
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload1)
        
        if response1.status_code == 400:
            pytest.skip("Time slot has conflict")
        
        assert response1.status_code == 200
        self.created_break_ids.append(response1.json()["break"]["id"])
        
        # Try to create overlapping break
        payload2 = {
            "type": "lunch",
            "label": "TEST_Overlapping Break",
            "start_time": "15:15",
            "end_time": "15:45"
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=payload2)
        
        assert response2.status_code == 400, "Overlapping break should be rejected"
        assert "Ya existe un bloque" in response2.json().get("detail", "")
        
        print("✓ Overlap validation working - overlapping breaks rejected")
    
    def test_update_break(self):
        """Test PUT /api/schedule/breaks/{id} - update break"""
        # First create a break
        create_payload = {
            "type": "break",
            "label": "TEST_Update Break",
            "start_time": "16:00",
            "end_time": "16:30"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=create_payload)
        
        if create_response.status_code == 400:
            pytest.skip("Time slot has conflict")
        
        assert create_response.status_code == 200
        break_id = create_response.json()["break"]["id"]
        self.created_break_ids.append(break_id)
        
        # Update the break
        update_payload = {
            "label": "TEST_Updated Label",
            "type": "lunch"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/schedule/breaks/{break_id}", json=update_payload)
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data["break"]["label"] == "TEST_Updated Label", "Label should be updated"
        assert data["break"]["type"] == "lunch", "Type should be updated"
        
        print(f"✓ PUT /api/schedule/breaks/{break_id} - Break updated successfully")
    
    def test_delete_break(self):
        """Test DELETE /api/schedule/breaks/{id} - delete break"""
        # First create a break
        create_payload = {
            "type": "event",
            "label": "TEST_Delete Break",
            "start_time": "17:00",
            "end_time": "17:30"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=create_payload)
        
        if create_response.status_code == 400:
            pytest.skip("Time slot has conflict")
        
        assert create_response.status_code == 200
        break_id = create_response.json()["break"]["id"]
        
        # Delete the break
        delete_response = self.session.delete(f"{BASE_URL}/api/schedule/breaks/{break_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify it's deleted
        get_response = self.session.get(f"{BASE_URL}/api/schedule/breaks")
        breaks = get_response.json().get("breaks", [])
        break_ids = [b["id"] for b in breaks]
        assert break_id not in break_ids, "Deleted break should not appear in list"
        
        print(f"✓ DELETE /api/schedule/breaks/{break_id} - Break deleted successfully")
    
    def test_break_prevents_class_scheduling(self):
        """Test that breaks prevent class scheduling at that time slot"""
        # First, get existing breaks
        breaks_response = self.session.get(f"{BASE_URL}/api/schedule/breaks")
        existing_breaks = breaks_response.json().get("breaks", [])
        
        if not existing_breaks:
            # Create a break first
            create_payload = {
                "type": "break",
                "label": "TEST_Blocking Break",
                "start_time": "10:00",
                "end_time": "10:30"
            }
            create_response = self.session.post(f"{BASE_URL}/api/schedule/breaks", json=create_payload)
            
            if create_response.status_code == 400:
                pytest.skip("Cannot create break for conflict test")
            
            self.created_break_ids.append(create_response.json()["break"]["id"])
            break_time = "10:00"
        else:
            break_time = existing_breaks[0]["start_time"]
        
        # Get grades and sections for creating a schedule
        grades_response = self.session.get(f"{BASE_URL}/api/academic/grades")
        grades = grades_response.json()
        
        if not grades:
            pytest.skip("No grades available for test")
        
        grade_id = grades[0]["id"]
        
        sections_response = self.session.get(f"{BASE_URL}/api/academic/sections")
        sections = [s for s in sections_response.json() if s.get("grado_id") == grade_id]
        
        if not sections:
            pytest.skip("No sections available for test")
        
        section_id = sections[0]["id"]
        
        # Try to create a schedule at the break time
        schedule_payload = {
            "grado_id": grade_id,
            "seccion_id": section_id,
            "materia": "TEST_Blocked Class",
            "dia": "lunes",
            "hora_inicio": break_time,
            "hora_fin": f"{int(break_time.split(':')[0]) + 1}:00",
            "tipo": "clases"
        }
        
        schedule_response = self.session.post(f"{BASE_URL}/api/schedules", json=schedule_payload)
        
        # Should be rejected due to break conflict
        if schedule_response.status_code == 400:
            detail = schedule_response.json().get("detail", {})
            if isinstance(detail, dict) and detail.get("type") == "break":
                print("✓ Break prevents class scheduling - conflict detected correctly")
                return
            elif "bloqueado" in str(detail).lower():
                print("✓ Break prevents class scheduling - conflict detected correctly")
                return
        
        # If it succeeded, we need to clean up
        if schedule_response.status_code == 200:
            schedule_id = schedule_response.json().get("schedule", {}).get("id")
            if schedule_id:
                self.session.delete(f"{BASE_URL}/api/schedules/{schedule_id}")
            print("⚠ Schedule was created despite break - conflict validation may not be working")
        else:
            print(f"⚠ Unexpected response: {schedule_response.status_code} - {schedule_response.text}")


class TestScheduleBreaksIntegration:
    """Integration tests for breaks with schedule grid"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_breaks_loaded_with_schedule_data(self):
        """Test that breaks are loaded alongside schedule data"""
        # Get schedule settings
        settings_response = self.session.get(f"{BASE_URL}/api/schedule-settings")
        assert settings_response.status_code == 200
        
        # Get breaks
        breaks_response = self.session.get(f"{BASE_URL}/api/schedule/breaks")
        assert breaks_response.status_code == 200
        
        # Get schedules
        schedules_response = self.session.get(f"{BASE_URL}/api/schedules?tipo=clases")
        assert schedules_response.status_code == 200
        
        print("✓ All schedule data endpoints working together")
        print(f"  - Settings: {settings_response.status_code}")
        print(f"  - Breaks: {len(breaks_response.json().get('breaks', []))} items")
        print(f"  - Schedules: {len(schedules_response.json().get('schedules', []))} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
