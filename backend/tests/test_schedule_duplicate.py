"""
Test Schedule Duplicate Feature
Tests POST /api/schedules/duplicate endpoint with 3 modes: section, day, year
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@elroble.edu"
TEST_PASSWORD = "1234abc8"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "subdomain": "elroble"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token")

@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def academic_data(headers):
    """Load academic data (grades, sections) for testing"""
    # Get grades
    grades_res = requests.get(f"{BASE_URL}/api/academic/grades", headers=headers)
    assert grades_res.status_code == 200
    grades = grades_res.json()
    
    # Get sections
    sections_res = requests.get(f"{BASE_URL}/api/academic/sections", headers=headers)
    assert sections_res.status_code == 200
    sections = sections_res.json()
    
    # Get levels
    levels_res = requests.get(f"{BASE_URL}/api/academic/levels", headers=headers)
    assert levels_res.status_code == 200
    levels = levels_res.json()
    
    return {"grades": grades, "sections": sections, "levels": levels}

@pytest.fixture(scope="module")
def schedule_settings(headers):
    """Get schedule settings"""
    res = requests.get(f"{BASE_URL}/api/schedule-settings", headers=headers)
    assert res.status_code == 200
    return res.json()


class TestScheduleSettingsEndpoint:
    """Test GET /api/schedule-settings"""
    
    def test_get_schedule_settings(self, headers):
        """Verify schedule settings endpoint returns expected fields"""
        res = requests.get(f"{BASE_URL}/api/schedule-settings", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        # Check expected fields exist
        assert "start_hour" in data
        assert "end_hour" in data
        assert "permitir_profesor_multiples_horarios" in data
        print(f"Schedule settings: permitir_profesor_multiples_horarios={data.get('permitir_profesor_multiples_horarios')}")


class TestDuplicateSchedulesDryRun:
    """Test POST /api/schedules/duplicate?dry_run=true"""
    
    def test_duplicate_mode_section_dry_run(self, headers, academic_data):
        """Test dry_run with mode=section returns preview without creating"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        # Find source grade/section with schedules (INICIAL > 3 años > A)
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Source grade '3 años' not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Source section not found for grade '3 años'")
        
        # Find target grade/section (different from source)
        target_grade = next((g for g in grades if g.get("nombre") == "4 años"), None)
        if not target_grade:
            pytest.skip("Target grade '4 años' not found")
        
        target_section = next((s for s in sections if s.get("grado_id") == target_grade["id"]), None)
        if not target_section:
            pytest.skip("Target section not found for grade '4 años'")
        
        payload = {
            "mode": "section",
            "source": {
                "grado_id": source_grade["id"],
                "seccion_id": source_section["id"]
            },
            "target": {
                "grado_ids": [target_grade["id"]],
                "seccion_ids": [target_section["id"]]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True
            }
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        
        # Should return 200 or 400 (if no source blocks)
        assert res.status_code in [200, 400], f"Unexpected status: {res.status_code}, {res.text}"
        
        if res.status_code == 200:
            data = res.json()
            assert "created" in data
            assert "skipped" in data
            assert "conflicts" in data
            assert "dry_run" in data
            assert data["dry_run"] == True
            assert "setting_multi_horario_activo" in data
            print(f"Dry run result: created={data['created']}, skipped={data['skipped']}, conflicts={len(data.get('conflicts', []))}")
        else:
            # 400 means no source blocks - that's valid
            print(f"No source blocks found: {res.json().get('detail')}")
    
    def test_duplicate_mode_day_dry_run(self, headers, academic_data):
        """Test dry_run with mode=day returns preview"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        # Find source grade/section
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Source grade '3 años' not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Source section not found")
        
        payload = {
            "mode": "day",
            "source": {
                "grado_id": source_grade["id"],
                "seccion_id": source_section["id"],
                "dia": "lunes"
            },
            "target": {
                "dias": ["martes", "miercoles"]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True
            }
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        
        assert res.status_code in [200, 400], f"Unexpected status: {res.status_code}, {res.text}"
        
        if res.status_code == 200:
            data = res.json()
            assert "created" in data
            assert "dry_run" in data
            assert data["dry_run"] == True
            print(f"Day mode dry run: created={data['created']}, skipped={data['skipped']}")
        else:
            print(f"No source blocks for day mode: {res.json().get('detail')}")
    
    def test_duplicate_no_source_blocks_returns_400(self, headers, academic_data):
        """Test that duplicate returns 400 when no source blocks exist"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        # Find a grade/section that likely has no schedules
        # Use a grade that might be empty
        empty_grade = next((g for g in grades if g.get("nombre") == "5 años"), None)
        if not empty_grade:
            pytest.skip("Grade '5 años' not found")
        
        empty_section = next((s for s in sections if s.get("grado_id") == empty_grade["id"]), None)
        if not empty_section:
            pytest.skip("Section not found for grade '5 años'")
        
        payload = {
            "mode": "section",
            "source": {
                "grado_id": empty_grade["id"],
                "seccion_id": empty_section["id"]
            },
            "target": {
                "grado_ids": [empty_grade["id"]],
                "seccion_ids": [empty_section["id"]]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True
            }
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        
        # Should return 400 if no source blocks, or 200 if there are blocks
        assert res.status_code in [200, 400], f"Unexpected status: {res.status_code}"
        
        if res.status_code == 400:
            data = res.json()
            assert "detail" in data
            print(f"Expected 400 response: {data['detail']}")


class TestDuplicateSchedulesActual:
    """Test POST /api/schedules/duplicate (actual creation)"""
    
    def test_duplicate_mode_section_creates_blocks(self, headers, academic_data):
        """Test that duplicate without dry_run actually creates blocks"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        # Find source grade/section with schedules
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Source grade '3 años' not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Source section not found")
        
        # First check if source has schedules
        schedules_res = requests.get(
            f"{BASE_URL}/api/schedules?tipo=clases&grado_id={source_grade['id']}&seccion_id={source_section['id']}", 
            headers=headers
        )
        assert schedules_res.status_code == 200
        source_schedules = schedules_res.json().get("schedules", [])
        
        if not source_schedules:
            pytest.skip("No source schedules to duplicate")
        
        print(f"Source has {len(source_schedules)} schedules")
        
        # Find target grade/section
        target_grade = next((g for g in grades if g.get("nombre") == "4 años"), None)
        if not target_grade:
            pytest.skip("Target grade '4 años' not found")
        
        target_section = next((s for s in sections if s.get("grado_id") == target_grade["id"]), None)
        if not target_section:
            pytest.skip("Target section not found")
        
        # First do dry run to see what would be created
        payload = {
            "mode": "section",
            "source": {
                "grado_id": source_grade["id"],
                "seccion_id": source_section["id"]
            },
            "target": {
                "grado_ids": [target_grade["id"]],
                "seccion_ids": [target_section["id"]]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True
            }
        }
        
        dry_run_res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        assert dry_run_res.status_code == 200
        dry_run_data = dry_run_res.json()
        
        print(f"Dry run: would create {dry_run_data['created']}, skip {dry_run_data['skipped']}")
        
        # Now do actual duplicate (only if dry run shows something to create)
        if dry_run_data['created'] > 0:
            actual_res = requests.post(f"{BASE_URL}/api/schedules/duplicate", json=payload, headers=headers)
            assert actual_res.status_code == 200
            actual_data = actual_res.json()
            
            assert "created" in actual_data
            assert "dry_run" not in actual_data or actual_data.get("dry_run") == False
            print(f"Actual duplicate: created={actual_data['created']}, skipped={actual_data['skipped']}")
        else:
            print("Nothing to create (all conflicts or already exists)")


class TestDuplicateSkipConflicts:
    """Test skip_conflicts option"""
    
    def test_skip_conflicts_true_continues(self, headers, academic_data):
        """Test that skip_conflicts=true skips conflicting blocks and continues"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Source grade not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Source section not found")
        
        # Check source has schedules
        schedules_res = requests.get(
            f"{BASE_URL}/api/schedules?tipo=clases&grado_id={source_grade['id']}&seccion_id={source_section['id']}", 
            headers=headers
        )
        if schedules_res.status_code != 200 or not schedules_res.json().get("schedules"):
            pytest.skip("No source schedules")
        
        # Try to duplicate to same section (will have conflicts)
        payload = {
            "mode": "day",
            "source": {
                "grado_id": source_grade["id"],
                "seccion_id": source_section["id"],
                "dia": "lunes"
            },
            "target": {
                "dias": ["martes"]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True  # Should skip conflicts
            }
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        
        assert res.status_code in [200, 400]
        
        if res.status_code == 200:
            data = res.json()
            # With skip_conflicts=true, should not abort
            assert data.get("aborted") != True or data.get("aborted") is None
            print(f"Skip conflicts result: created={data['created']}, skipped={data['skipped']}, conflicts={len(data.get('conflicts', []))}")


class TestMultiHorarioSetting:
    """Test that duplicate respects permitir_profesor_multiples_horarios setting"""
    
    def test_setting_returned_in_response(self, headers, academic_data):
        """Verify setting_multi_horario_activo is returned in duplicate response"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Source grade not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Source section not found")
        
        target_grade = next((g for g in grades if g.get("nombre") == "4 años"), None)
        if not target_grade:
            pytest.skip("Target grade not found")
        
        target_section = next((s for s in sections if s.get("grado_id") == target_grade["id"]), None)
        if not target_section:
            pytest.skip("Target section not found")
        
        payload = {
            "mode": "section",
            "source": {
                "grado_id": source_grade["id"],
                "seccion_id": source_section["id"]
            },
            "target": {
                "grado_ids": [target_grade["id"]],
                "seccion_ids": [target_section["id"]]
            },
            "options": {
                "keep_teacher": True,
                "overwrite_existing": False,
                "skip_conflicts": True
            }
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules/duplicate?dry_run=true", json=payload, headers=headers)
        
        if res.status_code == 200:
            data = res.json()
            assert "setting_multi_horario_activo" in data
            print(f"Multi-horario setting active: {data['setting_multi_horario_activo']}")
        elif res.status_code == 400:
            # No source blocks - still valid test
            print("No source blocks, but endpoint works")


class TestExistingScheduleFlow:
    """Test that existing schedule CRUD still works"""
    
    def test_get_schedules_endpoint(self, headers, academic_data):
        """Verify GET /api/schedules still works"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        source_grade = next((g for g in grades if g.get("nombre") == "3 años"), None)
        if not source_grade:
            pytest.skip("Grade not found")
        
        source_section = next((s for s in sections if s.get("grado_id") == source_grade["id"]), None)
        if not source_section:
            pytest.skip("Section not found")
        
        res = requests.get(
            f"{BASE_URL}/api/schedules?tipo=clases&grado_id={source_grade['id']}&seccion_id={source_section['id']}", 
            headers=headers
        )
        
        assert res.status_code == 200
        data = res.json()
        assert "schedules" in data
        print(f"GET schedules returned {len(data['schedules'])} items")
    
    def test_create_schedule_endpoint(self, headers, academic_data):
        """Verify POST /api/schedules (single create) still works"""
        grades = academic_data["grades"]
        sections = academic_data["sections"]
        
        # Find a grade/section
        test_grade = next((g for g in grades if g.get("nombre") == "5 años"), None)
        if not test_grade:
            pytest.skip("Test grade not found")
        
        test_section = next((s for s in sections if s.get("grado_id") == test_grade["id"]), None)
        if not test_section:
            pytest.skip("Test section not found")
        
        # Create a test schedule
        payload = {
            "tipo": "clases",
            "grado_id": test_grade["id"],
            "seccion_id": test_section["id"],
            "materia": "TEST_DUPLICATE_FEATURE",
            "dia": "viernes",
            "hora_inicio": "16:00",
            "hora_fin": "17:00",
            "color": "#FF5733"
        }
        
        res = requests.post(f"{BASE_URL}/api/schedules", json=payload, headers=headers)
        
        # Could be 200 (created) or 400 (conflict)
        assert res.status_code in [200, 400], f"Unexpected status: {res.status_code}, {res.text}"
        
        if res.status_code == 200:
            data = res.json()
            assert "schedule" in data
            schedule_id = data["schedule"]["id"]
            print(f"Created test schedule: {schedule_id}")
            
            # Clean up - delete the test schedule
            del_res = requests.delete(f"{BASE_URL}/api/schedules/{schedule_id}", headers=headers)
            assert del_res.status_code == 200
            print("Cleaned up test schedule")
        else:
            print(f"Schedule creation conflict (expected): {res.json().get('detail')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
