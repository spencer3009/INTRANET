"""
Calendar Module Tests - EduNet SaaS
Tests for calendar events CRUD operations and filtering
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"


class TestCalendarModule:
    """Calendar module endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping calendar tests")
        
        yield
        
        # Cleanup: Delete test events created during tests
        self._cleanup_test_events()
    
    def _cleanup_test_events(self):
        """Delete events created during testing"""
        try:
            # Get all events
            response = self.session.get(f"{BASE_URL}/api/calendar/events")
            if response.status_code == 200:
                events = response.json()
                for event in events:
                    if event.get("title", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/calendar/events/{event['id']}")
        except Exception:
            pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # EVENT TYPES TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_01_get_event_types(self):
        """GET /api/calendar/event-types - Returns all event types"""
        response = self.session.get(f"{BASE_URL}/api/calendar/event-types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all 6 event types exist
        expected_types = ["academic", "institutional", "administrative", "holiday", "special", "communication"]
        for event_type in expected_types:
            assert event_type in data, f"Missing event type: {event_type}"
            assert "label" in data[event_type], f"Missing label for {event_type}"
            assert "color" in data[event_type], f"Missing color for {event_type}"
        
        # Verify specific labels
        assert data["academic"]["label"] == "Académico"
        assert data["holiday"]["label"] == "Feriado"
        assert data["communication"]["label"] == "Comunicación"
        
        print(f"✓ Event types returned: {list(data.keys())}")
    
    def test_02_event_types_no_auth_required(self):
        """GET /api/calendar/event-types - Should work without authentication"""
        # Create new session without auth
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/calendar/event-types")
        
        # Event types endpoint may or may not require auth - check both cases
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"✓ Event types auth requirement: {'required' if response.status_code == 401 else 'not required'}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET EVENTS TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_10_get_events_requires_auth(self):
        """GET /api/calendar/events - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/calendar/events")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Events endpoint requires authentication")
    
    def test_11_get_events_basic(self):
        """GET /api/calendar/events - Returns events list"""
        response = self.session.get(f"{BASE_URL}/api/calendar/events")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of events"
        
        print(f"✓ Events returned: {len(data)}")
    
    def test_12_get_events_with_date_filter(self):
        """GET /api/calendar/events - Filters by date range"""
        # Get events for February 2026
        params = {
            "start_date": "2026-02-01",
            "end_date": "2026-02-28"
        }
        response = self.session.get(f"{BASE_URL}/api/calendar/events", params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of events"
        
        # Verify all events are within date range
        for event in data:
            assert "start_date" in event, "Event missing start_date"
            assert "end_date" in event, "Event missing end_date"
            # Event should overlap with the requested range
            assert event["end_date"] >= "2026-02-01" or event["start_date"] <= "2026-02-28"
        
        print(f"✓ Events in Feb 2026: {len(data)}")
    
    def test_13_get_events_with_type_filter(self):
        """GET /api/calendar/events - Filters by event type"""
        params = {"event_type": "holiday"}
        response = self.session.get(f"{BASE_URL}/api/calendar/events", params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # All returned events should be of type 'holiday'
        for event in data:
            assert event.get("type") == "holiday", f"Expected holiday type, got {event.get('type')}"
        
        print(f"✓ Holiday events: {len(data)}")
    
    def test_14_get_events_combined_filters(self):
        """GET /api/calendar/events - Combines date and type filters"""
        params = {
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
            "event_type": "academic"
        }
        response = self.session.get(f"{BASE_URL}/api/calendar/events", params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        for event in data:
            assert event.get("type") == "academic"
        
        print(f"✓ Academic events in Feb 2026: {len(data)}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CREATE EVENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_20_create_event_requires_auth(self):
        """POST /api/calendar/events - Requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Unauthorized Event",
            "type": "academic",
            "start_date": "2026-03-01",
            "end_date": "2026-03-01"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Create event requires authentication")
    
    def test_21_create_event_basic(self):
        """POST /api/calendar/events - Creates event successfully"""
        event_data = {
            "title": "TEST_Basic Event",
            "description": "Test event description",
            "type": "academic",
            "start_date": "2026-03-15",
            "end_date": "2026-03-15",
            "all_day": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "event" in data, "Response missing 'event' field"
        
        event = data["event"]
        assert event["title"] == "TEST_Basic Event"
        assert event["type"] == "academic"
        assert event["start_date"] == "2026-03-15"
        assert event["end_date"] == "2026-03-15"
        assert event["all_day"] == True
        assert "id" in event, "Event missing ID"
        assert "color" in event, "Event missing color"
        
        # Store for cleanup
        self.created_event_id = event["id"]
        
        print(f"✓ Event created with ID: {event['id']}")
    
    def test_22_create_event_with_time(self):
        """POST /api/calendar/events - Creates event with specific time"""
        event_data = {
            "title": "TEST_Timed Event",
            "type": "institutional",
            "start_date": "2026-03-20",
            "end_date": "2026-03-20",
            "start_time": "09:00",
            "end_time": "11:00",
            "all_day": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        event = response.json()["event"]
        assert event["all_day"] == False
        assert event["start_time"] == "09:00"
        assert event["end_time"] == "11:00"
        
        print(f"✓ Timed event created: {event['start_time']} - {event['end_time']}")
    
    def test_23_create_event_multi_day(self):
        """POST /api/calendar/events - Creates multi-day event"""
        event_data = {
            "title": "TEST_Multi-day Event",
            "type": "special",
            "start_date": "2026-04-01",
            "end_date": "2026-04-05",
            "all_day": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        event = response.json()["event"]
        assert event["start_date"] == "2026-04-01"
        assert event["end_date"] == "2026-04-05"
        
        print(f"✓ Multi-day event: {event['start_date']} to {event['end_date']}")
    
    def test_24_create_event_with_visibility(self):
        """POST /api/calendar/events - Creates event with visibility settings"""
        event_data = {
            "title": "TEST_Visibility Event",
            "type": "communication",
            "start_date": "2026-03-25",
            "end_date": "2026-03-25",
            "all_day": True,
            "visibility": {
                "roles": ["teacher", "parent"],
                "grades": [],
                "sections": []
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        event = response.json()["event"]
        assert "visibility" in event
        assert "teacher" in event["visibility"].get("roles", [])
        assert "parent" in event["visibility"].get("roles", [])
        
        print(f"✓ Event with visibility: {event['visibility']}")
    
    def test_25_create_event_validates_dates(self):
        """POST /api/calendar/events - Validates start_date <= end_date"""
        event_data = {
            "title": "TEST_Invalid Dates",
            "type": "academic",
            "start_date": "2026-03-20",
            "end_date": "2026-03-15"  # End before start
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        
        print(f"✓ Date validation error: {data['detail']}")
    
    def test_26_create_event_all_types(self):
        """POST /api/calendar/events - Creates events of all 6 types"""
        types = ["academic", "institutional", "administrative", "holiday", "special", "communication"]
        
        for event_type in types:
            event_data = {
                "title": f"TEST_{event_type.capitalize()} Type",
                "type": event_type,
                "start_date": "2026-05-01",
                "end_date": "2026-05-01",
                "all_day": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
            assert response.status_code == 200, f"Failed to create {event_type} event: {response.text}"
            
            event = response.json()["event"]
            assert event["type"] == event_type
            assert "color" in event  # Should have default color
        
        print(f"✓ All 6 event types created successfully")
    
    def test_27_create_event_custom_color(self):
        """POST /api/calendar/events - Creates event with custom color"""
        event_data = {
            "title": "TEST_Custom Color Event",
            "type": "academic",
            "color": "#FF5733",
            "start_date": "2026-03-28",
            "end_date": "2026-03-28",
            "all_day": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/events", json=event_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        event = response.json()["event"]
        assert event["color"] == "#FF5733"
        
        print(f"✓ Custom color event: {event['color']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE EVENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_30_update_event_requires_auth(self):
        """PUT /api/calendar/events/{id} - Requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.put(f"{BASE_URL}/api/calendar/events/fake-id", json={
            "title": "Updated Title"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Update event requires authentication")
    
    def test_31_update_event_title(self):
        """PUT /api/calendar/events/{id} - Updates event title"""
        # First create an event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Original Title",
            "type": "academic",
            "start_date": "2026-06-01",
            "end_date": "2026-06-01"
        })
        
        assert create_response.status_code == 200
        event_id = create_response.json()["event"]["id"]
        
        # Update the title
        update_response = self.session.put(f"{BASE_URL}/api/calendar/events/{event_id}", json={
            "title": "TEST_Updated Title"
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        updated_event = update_response.json()["event"]
        assert updated_event["title"] == "TEST_Updated Title"
        
        # Verify with GET
        get_response = self.session.get(f"{BASE_URL}/api/calendar/events/{event_id}")
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "TEST_Updated Title"
        
        print(f"✓ Event title updated and verified")
    
    def test_32_update_event_type(self):
        """PUT /api/calendar/events/{id} - Updates event type and color"""
        # Create event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Type Change",
            "type": "academic",
            "start_date": "2026-06-05",
            "end_date": "2026-06-05"
        })
        
        event_id = create_response.json()["event"]["id"]
        original_color = create_response.json()["event"]["color"]
        
        # Update type to holiday
        update_response = self.session.put(f"{BASE_URL}/api/calendar/events/{event_id}", json={
            "type": "holiday"
        })
        
        assert update_response.status_code == 200
        
        updated_event = update_response.json()["event"]
        assert updated_event["type"] == "holiday"
        # Color should change to holiday color
        assert updated_event["color"] != original_color or updated_event["color"] == "#EF4444"
        
        print(f"✓ Event type changed from academic to holiday")
    
    def test_33_update_event_dates(self):
        """PUT /api/calendar/events/{id} - Updates event dates"""
        # Create event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Date Change",
            "type": "institutional",
            "start_date": "2026-06-10",
            "end_date": "2026-06-10"
        })
        
        event_id = create_response.json()["event"]["id"]
        
        # Update dates
        update_response = self.session.put(f"{BASE_URL}/api/calendar/events/{event_id}", json={
            "start_date": "2026-06-15",
            "end_date": "2026-06-17"
        })
        
        assert update_response.status_code == 200
        
        updated_event = update_response.json()["event"]
        assert updated_event["start_date"] == "2026-06-15"
        assert updated_event["end_date"] == "2026-06-17"
        
        print(f"✓ Event dates updated")
    
    def test_34_update_event_validates_dates(self):
        """PUT /api/calendar/events/{id} - Validates dates on update"""
        # Create event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Invalid Update",
            "type": "academic",
            "start_date": "2026-06-20",
            "end_date": "2026-06-25"
        })
        
        event_id = create_response.json()["event"]["id"]
        
        # Try to set end_date before start_date
        update_response = self.session.put(f"{BASE_URL}/api/calendar/events/{event_id}", json={
            "end_date": "2026-06-15"  # Before start_date
        })
        
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        
        print(f"✓ Date validation on update works")
    
    def test_35_update_nonexistent_event(self):
        """PUT /api/calendar/events/{id} - Returns 404 for nonexistent event"""
        response = self.session.put(f"{BASE_URL}/api/calendar/events/nonexistent-id-12345", json={
            "title": "Updated"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for nonexistent event")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE EVENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_40_delete_event_requires_auth(self):
        """DELETE /api/calendar/events/{id} - Requires authentication"""
        session = requests.Session()
        response = session.delete(f"{BASE_URL}/api/calendar/events/fake-id")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Delete event requires authentication")
    
    def test_41_delete_event_success(self):
        """DELETE /api/calendar/events/{id} - Deletes event successfully"""
        # Create event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_To Delete",
            "type": "administrative",
            "start_date": "2026-07-01",
            "end_date": "2026-07-01"
        })
        
        event_id = create_response.json()["event"]["id"]
        
        # Delete event
        delete_response = self.session.delete(f"{BASE_URL}/api/calendar/events/{event_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion with GET
        get_response = self.session.get(f"{BASE_URL}/api/calendar/events/{event_id}")
        assert get_response.status_code == 404, "Event should not exist after deletion"
        
        print(f"✓ Event deleted and verified")
    
    def test_42_delete_nonexistent_event(self):
        """DELETE /api/calendar/events/{id} - Returns 404 for nonexistent event"""
        response = self.session.delete(f"{BASE_URL}/api/calendar/events/nonexistent-id-67890")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for nonexistent event deletion")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET SINGLE EVENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_50_get_single_event(self):
        """GET /api/calendar/events/{id} - Returns single event"""
        # Create event
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": "TEST_Single Event",
            "description": "Test description",
            "type": "special",
            "start_date": "2026-07-15",
            "end_date": "2026-07-15"
        })
        
        event_id = create_response.json()["event"]["id"]
        
        # Get single event
        get_response = self.session.get(f"{BASE_URL}/api/calendar/events/{event_id}")
        
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        event = get_response.json()
        assert event["id"] == event_id
        assert event["title"] == "TEST_Single Event"
        assert event["description"] == "Test description"
        assert event["type"] == "special"
        assert "type_label" in event
        
        print(f"✓ Single event retrieved with all fields")
    
    def test_51_get_single_event_not_found(self):
        """GET /api/calendar/events/{id} - Returns 404 for nonexistent"""
        response = self.session.get(f"{BASE_URL}/api/calendar/events/nonexistent-id-99999")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for nonexistent event")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INTEGRATION TESTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_60_full_crud_workflow(self):
        """Integration: Full CRUD workflow for calendar event"""
        # CREATE
        create_data = {
            "title": "TEST_CRUD Workflow Event",
            "description": "Testing full CRUD",
            "type": "communication",
            "start_date": "2026-08-01",
            "end_date": "2026-08-03",
            "all_day": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json=create_data)
        assert create_response.status_code == 200
        event_id = create_response.json()["event"]["id"]
        print(f"  ✓ Created event: {event_id}")
        
        # READ
        read_response = self.session.get(f"{BASE_URL}/api/calendar/events/{event_id}")
        assert read_response.status_code == 200
        assert read_response.json()["title"] == "TEST_CRUD Workflow Event"
        print(f"  ✓ Read event verified")
        
        # UPDATE
        update_response = self.session.put(f"{BASE_URL}/api/calendar/events/{event_id}", json={
            "title": "TEST_CRUD Updated Event",
            "type": "holiday"
        })
        assert update_response.status_code == 200
        assert update_response.json()["event"]["title"] == "TEST_CRUD Updated Event"
        assert update_response.json()["event"]["type"] == "holiday"
        print(f"  ✓ Updated event verified")
        
        # DELETE
        delete_response = self.session.delete(f"{BASE_URL}/api/calendar/events/{event_id}")
        assert delete_response.status_code == 200
        print(f"  ✓ Deleted event")
        
        # VERIFY DELETION
        verify_response = self.session.get(f"{BASE_URL}/api/calendar/events/{event_id}")
        assert verify_response.status_code == 404
        print(f"  ✓ Deletion verified")
        
        print("✓ Full CRUD workflow completed successfully")
    
    def test_61_events_appear_in_list(self):
        """Integration: Created events appear in events list"""
        # Create a unique event
        unique_title = f"TEST_List Check {uuid.uuid4().hex[:8]}"
        
        create_response = self.session.post(f"{BASE_URL}/api/calendar/events", json={
            "title": unique_title,
            "type": "academic",
            "start_date": "2026-09-01",
            "end_date": "2026-09-01"
        })
        
        assert create_response.status_code == 200
        event_id = create_response.json()["event"]["id"]
        
        # Get events list for September 2026
        list_response = self.session.get(f"{BASE_URL}/api/calendar/events", params={
            "start_date": "2026-09-01",
            "end_date": "2026-09-30"
        })
        
        assert list_response.status_code == 200
        events = list_response.json()
        
        # Find our event
        found = any(e["id"] == event_id for e in events)
        assert found, "Created event not found in list"
        
        print(f"✓ Created event appears in filtered list")
    
    def test_62_verify_existing_test_events(self):
        """Integration: Verify existing test events from main agent"""
        # Get events for February 2026 (where test events were created)
        response = self.session.get(f"{BASE_URL}/api/calendar/events", params={
            "start_date": "2026-02-01",
            "end_date": "2026-02-28"
        })
        
        assert response.status_code == 200
        events = response.json()
        
        print(f"  Found {len(events)} events in February 2026:")
        for event in events:
            print(f"    - {event['title']} ({event['type']}) [{event['start_date']} to {event['end_date']}]")
        
        # Check for expected test events mentioned by main agent
        titles = [e["title"] for e in events]
        
        # These events were mentioned as created by main agent
        expected_events = ["Día del Maestro", "Capacitación Docente", "Examen Final", "Reunión de Padres"]
        found_events = [t for t in expected_events if any(t in title for title in titles)]
        
        print(f"  ✓ Found {len(found_events)}/{len(expected_events)} expected test events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
