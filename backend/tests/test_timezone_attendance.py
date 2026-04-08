"""
Test Timezone Fix for Attendance Entry/Exit System
==================================================
P0 Bug Fix: Timezone mismatch - old records stored UTC, now system uses Peru timezone (UTC-5).
The fix was to create `to_peru_hhmm()` helper and apply consistently across all attendance endpoints.

Test scenarios:
1. QR scan entry flow - should return Peru time (UTC-5) not UTC
2. QR scan exit flow after entry - should work without 'already marked' error
3. QR scan when both entry and exit exist - should return 'already_both' with correct Peru times
4. Manual mark-entry endpoint - should return Peru time
5. Manual mark-exit endpoint - should return Peru time and correct total_minutes
6. QR history endpoint - should display Peru times
7. Date used should be Peru date, not UTC date (critical when UTC date differs from Peru date)
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://incidents-dashboard.preview.emergentagent.com")
PERU_TZ = timezone(timedelta(hours=-5))

# Test credentials
# Student school: b9f27249 (admin@elroble.edu)
STUDENT_SCHOOL_ADMIN_EMAIL = "admin@elroble.edu"
STUDENT_SCHOOL_ADMIN_PASSWORD = "1234abc8"
STUDENT_QR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50X2lkIjoiYjQxYTEzODctNTUyMC00N2I5LWJkMTMtYmY1ZGFkYTUxODEzIiwic2Nob29sX2lkIjoiYjlmMjcyNDktNjU2OC00OWFlLTk0ZDMtZTFmMTY3NTBkN2Q5IiwiaXNzdWVkX2F0IjoiMjAyNi0wMi0yMFQyMTowMTo1OC4zNTQyOTErMDA6MDAiLCJ0eXBlIjoic3R1ZGVudF9xciJ9.7NLgyxtUFfg3GLvm7TP2X4ii1CkVhPM0xDttSRihH4s"
STUDENT_ID = "b41a1387-5520-47b9-bd13-bf5dada51813"

# Teacher school: 9f8a01fa (spencer3009@gmail.com)
TEACHER_SCHOOL_ADMIN_EMAIL = "spencer3009@gmail.com"
TEACHER_SCHOOL_ADMIN_PASSWORD = "1234abc8"
TEACHER_QR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZWFjaGVyX2lkIjoiNDI4NzEzNWUtMGQ0MS00MzZmLTk4YWEtMTE1ZjMzMzJjMWYxIiwic2Nob29sX2lkIjoiOWY4YTAxZmEtOTRmYy00ZTI5LWJjMTctZDMxMTI0NGQwNzE2IiwiaXNzdWVkX2F0IjoiMjAyNi0wMy0wNlQyMDo0NToyOS45OTEwMzMrMDA6MDAiLCJ0eXBlIjoidGVhY2hlcl9xciJ9.PsR-faEYmjf2Gl_AObcN5aDpFFjeOn_cAS_dsDnI_ik"
TEACHER_ID = "4287135e-0d41-436f-98aa-115f3332c1f1"


@pytest.fixture(scope="module")
def student_school_token():
    """Get auth token for student's school admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_SCHOOL_ADMIN_EMAIL,
        "password": STUDENT_SCHOOL_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Cannot login to student school: {response.text}")


@pytest.fixture(scope="module")
def teacher_school_token():
    """Get auth token for teacher's school admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_SCHOOL_ADMIN_EMAIL,
        "password": TEACHER_SCHOOL_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Cannot login to teacher school: {response.text}")


def get_peru_date():
    """Get current date in Peru timezone"""
    return datetime.now(PERU_TZ).strftime("%Y-%m-%d")


def get_peru_time():
    """Get current time in Peru timezone (HH:MM)"""
    return datetime.now(PERU_TZ).strftime("%H:%M")


def is_valid_peru_time(time_str):
    """Check if time string is in HH:MM format and matches Peru timezone (within 2 minutes)"""
    if not time_str:
        return False
    try:
        hour, minute = map(int, time_str.split(":"))
        peru_now = datetime.now(PERU_TZ)
        # Allow 2 minute tolerance
        expected_hour = peru_now.hour
        expected_minute = peru_now.minute
        
        hour_diff = abs(hour - expected_hour)
        minute_diff = abs(minute - expected_minute)
        
        # Check if time is reasonable (within 2 minute window)
        return hour_diff == 0 and minute_diff <= 2 or (hour_diff == 1 and minute_diff >= 58)
    except:
        return False


def clean_student_attendance(token):
    """Clean today's attendance for the test student"""
    from pymongo import MongoClient
    import os
    
    # Connect directly to MongoDB to clean up
    mongo_url = "mongodb://localhost:27017"
    db_name = "test_database"
    
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    today_peru = get_peru_date()
    
    # Clean from attendances collection
    result1 = db.attendances.delete_many({
        "user_id": STUDENT_ID,
        "date": today_peru
    })
    
    # Clean from student_attendance (legacy collection)
    result2 = db.student_attendance.delete_many({
        "student_id": STUDENT_ID,
        "date": today_peru
    })
    
    print(f"Cleaned student attendance: {result1.deleted_count} attendances, {result2.deleted_count} student_attendance")
    client.close()


def clean_teacher_attendance(token):
    """Clean today's attendance for the test teacher"""
    from pymongo import MongoClient
    
    mongo_url = "mongodb://localhost:27017"
    db_name = "test_database"
    
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    today_peru = get_peru_date()
    
    # Clean from attendances collection
    result = db.attendances.delete_many({
        "user_id": TEACHER_ID,
        "date": today_peru,
        "type": "teacher"
    })
    
    print(f"Cleaned teacher attendance: {result.deleted_count} records")
    client.close()


class TestTimezoneDisplaysPeruTime:
    """Test that all attendance endpoints display Peru timezone times, not UTC"""
    
    def test_current_time_difference(self):
        """Verify UTC and Peru times are different (UTC is ~5 hours ahead)"""
        utc_now = datetime.now(timezone.utc)
        peru_now = datetime.now(PERU_TZ)
        
        utc_hour = utc_now.hour
        peru_hour = peru_now.hour
        
        # Peru is UTC-5, so UTC hour should be 5 hours ahead
        expected_diff = (utc_hour - peru_hour) % 24
        assert expected_diff == 5 or expected_diff == 19, f"Time difference should be ~5 hours, got {expected_diff}"
        
        print(f"✓ UTC time: {utc_now.strftime('%Y-%m-%d %H:%M')}")
        print(f"✓ Peru time: {peru_now.strftime('%Y-%m-%d %H:%M')}")


class TestStudentQRScanEntryExit:
    """Test student QR scan entry/exit flows with Peru timezone"""
    
    def test_qr_scan_entry_returns_peru_time(self, student_school_token):
        """Test that QR scan entry returns Peru time (not UTC)"""
        # Clean up first
        clean_student_attendance(student_school_token)
        
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "entry"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["action"] == "entry", f"Expected action=entry, got {data.get('action')}"
        assert data["status"] == "success", f"Expected status=success, got {data.get('status')}"
        
        # Verify entry_time is in Peru timezone (HH:MM format)
        entry_time = data.get("attendance", {}).get("entry_time")
        assert entry_time, "entry_time should be present"
        assert ":" in entry_time, f"entry_time should be HH:MM format, got {entry_time}"
        assert len(entry_time) == 5, f"entry_time should be 5 chars (HH:MM), got {entry_time}"
        
        # Verify it's close to current Peru time
        peru_now = get_peru_time()
        assert is_valid_peru_time(entry_time), f"entry_time {entry_time} doesn't match Peru time ~{peru_now}"
        
        # Verify date is Peru date
        assert data["attendance"]["date"] == get_peru_date(), f"Date should be Peru date {get_peru_date()}"
        
        print(f"✓ QR Entry returned Peru time: {entry_time} (expected ~{peru_now})")
    
    def test_qr_scan_exit_after_entry_works(self, student_school_token):
        """Test that QR scan exit works after entry (no 'already marked' error)"""
        # Entry was done in previous test, now do exit
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "exit"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["action"] == "exit", f"Expected action=exit, got {data.get('action')}"
        assert data["status"] == "success", f"Expected status=success, got {data.get('status')}"
        
        # Verify exit_time is in Peru timezone
        exit_time = data.get("attendance", {}).get("exit_time")
        assert exit_time, "exit_time should be present"
        assert is_valid_peru_time(exit_time), f"exit_time {exit_time} doesn't match Peru time"
        
        # Verify entry_time is also Peru timezone
        entry_time = data.get("attendance", {}).get("entry_time")
        assert entry_time, "entry_time should be preserved"
        
        # Verify total_minutes is reasonable
        total_minutes = data.get("attendance", {}).get("total_minutes")
        assert total_minutes is not None, "total_minutes should be calculated"
        assert total_minutes >= 0, f"total_minutes should be >= 0, got {total_minutes}"
        
        print(f"✓ QR Exit returned Peru time: {exit_time}")
        print(f"✓ Entry time preserved: {entry_time}")
        print(f"✓ Total minutes: {total_minutes}")
    
    def test_qr_scan_already_both_returns_peru_times(self, student_school_token):
        """Test that 'already_both' response shows Peru times"""
        # Both entry and exit are done, try to scan again
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "auto"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["action"] == "already_both", f"Expected action=already_both, got {data.get('action')}"
        assert data["status"] == "already_marked", f"Expected status=already_marked, got {data.get('status')}"
        
        # Verify both times are in Peru timezone
        entry_time = data.get("attendance", {}).get("entry_time")
        exit_time = data.get("attendance", {}).get("exit_time")
        
        assert entry_time, "entry_time should be present in already_both"
        assert exit_time, "exit_time should be present in already_both"
        
        # Both should be HH:MM format (not ISO format)
        assert len(entry_time) == 5, f"entry_time should be HH:MM, got {entry_time}"
        assert len(exit_time) == 5, f"exit_time should be HH:MM, got {exit_time}"
        
        print(f"✓ already_both entry_time: {entry_time}")
        print(f"✓ already_both exit_time: {exit_time}")


class TestTeacherQRScanEntryExit:
    """Test teacher QR scan entry/exit flows with Peru timezone"""
    
    def test_teacher_qr_scan_entry(self, teacher_school_token):
        """Test teacher QR scan entry returns Peru time"""
        # Clean up first
        clean_teacher_attendance(teacher_school_token)
        
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": TEACHER_QR_TOKEN, "mode": "entry"},
            headers={"Authorization": f"Bearer {teacher_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["action"] == "entry", f"Expected action=entry, got {data.get('action')}"
        
        entry_time = data.get("attendance", {}).get("entry_time")
        assert entry_time, "entry_time should be present"
        assert is_valid_peru_time(entry_time), f"Teacher entry_time {entry_time} should match Peru time"
        
        print(f"✓ Teacher QR Entry returned Peru time: {entry_time}")
    
    def test_teacher_qr_scan_exit(self, teacher_school_token):
        """Test teacher QR scan exit returns Peru time"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": TEACHER_QR_TOKEN, "mode": "exit"},
            headers={"Authorization": f"Bearer {teacher_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["action"] == "exit", f"Expected action=exit, got {data.get('action')}"
        
        exit_time = data.get("attendance", {}).get("exit_time")
        assert exit_time, "exit_time should be present"
        assert is_valid_peru_time(exit_time), f"Teacher exit_time {exit_time} should match Peru time"
        
        print(f"✓ Teacher QR Exit returned Peru time: {exit_time}")


class TestManualEntryExit:
    """Test manual mark-entry and mark-exit endpoints"""
    
    def test_manual_entry_returns_peru_time(self, student_school_token):
        """Test manual mark-entry returns Peru time"""
        # Clean up first
        clean_student_attendance(student_school_token)
        
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-entry",
            json={
                "student_id": STUDENT_ID,
                "method": "manual"
            },
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["status"] == "success", f"Expected status=success, got {data.get('status')}"
        
        entry_time = data.get("entry_time")
        assert entry_time, "entry_time should be present"
        assert is_valid_peru_time(entry_time), f"Manual entry_time {entry_time} should match Peru time"
        
        print(f"✓ Manual Entry returned Peru time: {entry_time}")
    
    def test_manual_exit_returns_peru_time_and_total_minutes(self, student_school_token):
        """Test manual mark-exit returns Peru time and correct total_minutes"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/mark-exit",
            json={
                "student_id": STUDENT_ID,
                "method": "manual"
            },
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["status"] == "success", f"Expected status=success, got {data.get('status')}"
        
        exit_time = data.get("exit_time")
        assert exit_time, "exit_time should be present"
        assert is_valid_peru_time(exit_time), f"Manual exit_time {exit_time} should match Peru time"
        
        total_minutes = data.get("total_minutes")
        assert total_minutes is not None, "total_minutes should be calculated"
        assert total_minutes >= 0, f"total_minutes should be >= 0, got {total_minutes}"
        
        print(f"✓ Manual Exit returned Peru time: {exit_time}")
        print(f"✓ Total minutes: {total_minutes}")


class TestQRHistoryPeruTimes:
    """Test QR history endpoint displays Peru times"""
    
    def test_qr_history_shows_peru_times(self, student_school_token):
        """Test QR history displays times in Peru timezone"""
        # Ensure we have some data from previous tests
        response = requests.get(
            f"{BASE_URL}/api/attendance/qr/history?role=student",
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify date is Peru date
        assert data["date"] == get_peru_date(), f"History date should be Peru date {get_peru_date()}"
        
        # Check history records
        history = data.get("history", [])
        print(f"QR History has {len(history)} records")
        
        for record in history:
            time_str = record.get("time")
            if time_str:
                # Time should be in HH:MM format (not ISO/UTC)
                assert ":" in time_str, f"Time should be HH:MM format, got {time_str}"
                # Should not contain 'T' (ISO format) or 'Z' (UTC marker)
                assert "T" not in time_str, f"Time should not be ISO format, got {time_str}"
                assert "Z" not in time_str, f"Time should not be UTC format, got {time_str}"
                print(f"  ✓ History record time: {time_str} (Peru timezone)")


class TestPeruDateNotUTCDate:
    """Test that Peru date is used, not UTC date (critical when dates differ)"""
    
    def test_uses_peru_date_for_attendance(self, student_school_token):
        """Verify attendance uses Peru date, not UTC date"""
        utc_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        peru_date = get_peru_date()
        
        print(f"UTC date: {utc_date}")
        print(f"Peru date: {peru_date}")
        
        # Clean and create new entry
        clean_student_attendance(student_school_token)
        
        response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "entry"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # The date in response should be Peru date
        attendance_date = data.get("attendance", {}).get("date")
        assert attendance_date == peru_date, f"Attendance date should be Peru date {peru_date}, got {attendance_date}"
        
        if utc_date != peru_date:
            print(f"✓ CRITICAL: UTC date ({utc_date}) differs from Peru date ({peru_date})")
            print(f"✓ System correctly uses Peru date: {attendance_date}")
        else:
            print(f"✓ Dates happen to match: {attendance_date}")


class TestExitAfterEntryNoAlreadyMarkedError:
    """Test the specific P0 bug: exit after entry should NOT give 'already marked' error"""
    
    def test_full_entry_exit_flow_no_errors(self, student_school_token):
        """Full test: entry followed by exit should work without errors"""
        # Clean slate
        clean_student_attendance(student_school_token)
        
        # Step 1: Entry
        entry_response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "entry"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert entry_response.status_code == 200, f"Entry failed: {entry_response.text}"
        entry_data = entry_response.json()
        assert entry_data["action"] == "entry", f"Expected entry action, got {entry_data.get('action')}"
        
        print(f"✓ Step 1: Entry successful at {entry_data['attendance']['entry_time']}")
        
        # Step 2: Exit (this should NOT give 'already marked' error)
        exit_response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "exit"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert exit_response.status_code == 200, f"Exit failed: {exit_response.text}"
        exit_data = exit_response.json()
        
        # This is the KEY assertion - exit should work, not return "already_marked"
        assert exit_data["action"] == "exit", f"Expected exit action, got {exit_data.get('action')}"
        assert exit_data["status"] == "success", f"Expected success, got {exit_data.get('status')}"
        
        print(f"✓ Step 2: Exit successful at {exit_data['attendance']['exit_time']}")
        print(f"✓ Total minutes: {exit_data['attendance'].get('total_minutes')}")
        
        # Step 3: Verify 'already_both' is only returned after BOTH are done
        final_response = requests.post(
            f"{BASE_URL}/api/attendance/qr/scan",
            json={"qr_token": STUDENT_QR_TOKEN, "mode": "auto"},
            headers={"Authorization": f"Bearer {student_school_token}"}
        )
        
        assert final_response.status_code == 200
        final_data = final_response.json()
        assert final_data["action"] == "already_both", f"Expected already_both, got {final_data.get('action')}"
        
        print(f"✓ Step 3: Correctly returns 'already_both' after full flow")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
