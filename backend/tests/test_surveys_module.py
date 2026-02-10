"""
Test Suite for Surveys Module (Encuestas Institucionales)
Tests all CRUD operations and survey answering functionality.

Endpoints tested:
- GET /api/surveys - List surveys (with status filter)
- GET /api/surveys/{id} - Get single survey
- POST /api/surveys - Create survey
- PUT /api/surveys/{id} - Update survey
- PUT /api/surveys/{id}/close - Close survey
- DELETE /api/surveys/{id} - Delete survey
- POST /api/surveys/{id}/answer - Answer survey
- GET /api/surveys/{id}/results - Get survey results with charts data
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin.settings@test.pe"
TEST_PASSWORD = "test123"
TEST_SUBDOMAIN = "demosettings"


class TestSurveysModule:
    """Test suite for Surveys Module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.created_survey_ids = []
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        yield
        
        # Cleanup: Delete created surveys
        for survey_id in self.created_survey_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/surveys/{survey_id}")
            except:
                pass
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/surveys - List Surveys
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_surveys_returns_list(self):
        """GET /api/surveys - Returns list of surveys"""
        response = self.session.get(f"{BASE_URL}/api/surveys")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/surveys returns list with {len(data)} surveys")
    
    def test_get_surveys_filter_by_status_draft(self):
        """GET /api/surveys?status=draft - Filters by draft status"""
        response = self.session.get(f"{BASE_URL}/api/surveys", params={"status": "draft"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for survey in data:
            assert survey.get("status") == "draft"
        print(f"✓ GET /api/surveys?status=draft returns {len(data)} draft surveys")
    
    def test_get_surveys_filter_by_status_active(self):
        """GET /api/surveys?status=active - Filters by active status"""
        response = self.session.get(f"{BASE_URL}/api/surveys", params={"status": "active"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for survey in data:
            assert survey.get("status") == "active"
        print(f"✓ GET /api/surveys?status=active returns {len(data)} active surveys")
    
    def test_get_surveys_filter_by_status_closed(self):
        """GET /api/surveys?status=closed - Filters by closed status"""
        response = self.session.get(f"{BASE_URL}/api/surveys", params={"status": "closed"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for survey in data:
            assert survey.get("status") == "closed"
        print(f"✓ GET /api/surveys?status=closed returns {len(data)} closed surveys")
    
    def test_get_surveys_requires_auth(self):
        """GET /api/surveys - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/surveys")
        
        assert response.status_code == 401
        print("✓ GET /api/surveys requires authentication")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/surveys - Create Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_create_survey_draft(self):
        """POST /api/surveys - Creates survey as draft"""
        payload = {
            "question": f"TEST_Survey_Draft_{uuid.uuid4().hex[:8]}",
            "options": ["Opción A", "Opción B", "Opción C"],
            "target_roles": [],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "survey" in data
        survey = data["survey"]
        assert survey["question"] == payload["question"]
        assert survey["options"] == payload["options"]
        assert survey["status"] == "draft"
        assert "id" in survey
        
        self.created_survey_ids.append(survey["id"])
        print(f"✓ POST /api/surveys creates draft survey: {survey['id']}")
    
    def test_create_survey_active(self):
        """POST /api/surveys - Creates survey as active (published)"""
        payload = {
            "question": f"TEST_Survey_Active_{uuid.uuid4().hex[:8]}",
            "options": ["Sí", "No"],
            "target_roles": [],
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        survey = data["survey"]
        assert survey["status"] == "active"
        
        self.created_survey_ids.append(survey["id"])
        print(f"✓ POST /api/surveys creates active survey: {survey['id']}")
    
    def test_create_survey_with_target_roles(self):
        """POST /api/surveys - Creates survey with specific target roles"""
        payload = {
            "question": f"TEST_Survey_Roles_{uuid.uuid4().hex[:8]}",
            "options": ["Excelente", "Bueno", "Regular", "Malo"],
            "target_roles": ["teacher", "student"],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        survey = data["survey"]
        assert survey["target_roles"] == ["teacher", "student"]
        
        self.created_survey_ids.append(survey["id"])
        print(f"✓ POST /api/surveys creates survey with target roles: {survey['target_roles']}")
    
    def test_create_survey_minimum_options(self):
        """POST /api/surveys - Requires at least 2 options"""
        payload = {
            "question": "Test question",
            "options": ["Solo una opción"],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code in [400, 422]
        print("✓ POST /api/surveys validates minimum 2 options")
    
    def test_create_survey_empty_options_filtered(self):
        """POST /api/surveys - Filters empty options"""
        payload = {
            "question": f"TEST_Survey_EmptyOpts_{uuid.uuid4().hex[:8]}",
            "options": ["Opción válida", "", "Otra opción", "   "],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        survey = data["survey"]
        # Empty options should be filtered out
        assert len(survey["options"]) == 2
        assert "" not in survey["options"]
        
        self.created_survey_ids.append(survey["id"])
        print("✓ POST /api/surveys filters empty options")
    
    def test_create_survey_includes_creator_info(self):
        """POST /api/surveys - Includes creator information"""
        payload = {
            "question": f"TEST_Survey_Creator_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        }
        
        response = self.session.post(f"{BASE_URL}/api/surveys", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        survey = data["survey"]
        assert "created_by" in survey
        assert "created_by_name" in survey
        assert "created_at" in survey
        
        self.created_survey_ids.append(survey["id"])
        print(f"✓ POST /api/surveys includes creator info: {survey['created_by_name']}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/surveys/{id} - Get Single Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_single_survey(self):
        """GET /api/surveys/{id} - Returns single survey"""
        # First create a survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Get_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Get the survey
        response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == survey_id
        assert "response_count" in data
        assert "user_has_responded" in data
        print(f"✓ GET /api/surveys/{survey_id} returns survey details")
    
    def test_get_survey_not_found(self):
        """GET /api/surveys/{id} - Returns 404 for nonexistent survey"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/surveys/{fake_id}")
        
        assert response.status_code == 404
        print("✓ GET /api/surveys/{id} returns 404 for nonexistent survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/surveys/{id} - Update Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_update_survey_question(self):
        """PUT /api/surveys/{id} - Updates survey question"""
        # Create survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Update_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Update question
        new_question = f"Updated_Question_{uuid.uuid4().hex[:8]}"
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "question": new_question
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["survey"]["question"] == new_question
        print(f"✓ PUT /api/surveys/{survey_id} updates question")
    
    def test_update_survey_options(self):
        """PUT /api/surveys/{id} - Updates survey options (no responses)"""
        # Create survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_UpdateOpts_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Update options
        new_options = ["Opción 1", "Opción 2", "Opción 3"]
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "options": new_options
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["survey"]["options"] == new_options
        print(f"✓ PUT /api/surveys/{survey_id} updates options")
    
    def test_update_survey_status_to_active(self):
        """PUT /api/surveys/{id} - Changes status from draft to active"""
        # Create draft survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Publish_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Publish (change to active)
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "status": "active"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["survey"]["status"] == "active"
        print(f"✓ PUT /api/surveys/{survey_id} publishes survey (draft -> active)")
    
    def test_update_survey_target_roles(self):
        """PUT /api/surveys/{id} - Updates target roles"""
        # Create survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Roles_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "target_roles": [],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Update target roles
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "target_roles": ["teacher", "parent"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["survey"]["target_roles"] == ["teacher", "parent"]
        print(f"✓ PUT /api/surveys/{survey_id} updates target roles")
    
    def test_update_survey_not_found(self):
        """PUT /api/surveys/{id} - Returns 404 for nonexistent survey"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/surveys/{fake_id}", json={
            "question": "New question"
        })
        
        assert response.status_code == 404
        print("✓ PUT /api/surveys/{id} returns 404 for nonexistent survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUT /api/surveys/{id}/close - Close Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_close_survey(self):
        """PUT /api/surveys/{id}/close - Closes an active survey"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Close_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Close survey
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        
        assert response.status_code == 200
        
        # Verify it's closed
        get_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        assert get_response.json()["status"] == "closed"
        print(f"✓ PUT /api/surveys/{survey_id}/close closes survey")
    
    def test_close_already_closed_survey(self):
        """PUT /api/surveys/{id}/close - Returns error for already closed survey"""
        # Create and close survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_DoubleClose_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Close first time
        self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        
        # Try to close again
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        
        assert response.status_code == 400
        print("✓ PUT /api/surveys/{id}/close returns error for already closed survey")
    
    def test_cannot_edit_closed_survey(self):
        """PUT /api/surveys/{id} - Cannot edit closed survey"""
        # Create and close survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_EditClosed_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Close survey
        self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        
        # Try to edit
        response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "question": "New question"
        })
        
        assert response.status_code == 400
        print("✓ PUT /api/surveys/{id} cannot edit closed survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DELETE /api/surveys/{id} - Delete Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_delete_survey(self):
        """DELETE /api/surveys/{id} - Deletes survey"""
        # Create survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Delete_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        
        # Delete survey
        response = self.session.delete(f"{BASE_URL}/api/surveys/{survey_id}")
        
        assert response.status_code == 200
        
        # Verify it's deleted
        get_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        assert get_response.status_code == 404
        print(f"✓ DELETE /api/surveys/{survey_id} deletes survey")
    
    def test_delete_survey_not_found(self):
        """DELETE /api/surveys/{id} - Returns 404 for nonexistent survey"""
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/surveys/{fake_id}")
        
        assert response.status_code == 404
        print("✓ DELETE /api/surveys/{id} returns 404 for nonexistent survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POST /api/surveys/{id}/answer - Answer Survey
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_answer_survey(self):
        """POST /api/surveys/{id}/answer - Submits answer to active survey"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Answer_{uuid.uuid4().hex[:8]}",
            "options": ["Opción A", "Opción B", "Opción C"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Answer survey
        response = self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["answer"]["option_selected"] == 1
        print(f"✓ POST /api/surveys/{survey_id}/answer submits answer")
    
    def test_answer_survey_invalid_option(self):
        """POST /api/surveys/{id}/answer - Rejects invalid option index"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_InvalidOpt_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Try to answer with invalid option
        response = self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 99
        })
        
        assert response.status_code == 400
        print("✓ POST /api/surveys/{id}/answer rejects invalid option index")
    
    def test_answer_survey_cannot_answer_draft(self):
        """POST /api/surveys/{id}/answer - Cannot answer draft survey"""
        # Create draft survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_AnswerDraft_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "draft"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Try to answer
        response = self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 0
        })
        
        assert response.status_code == 400
        print("✓ POST /api/surveys/{id}/answer cannot answer draft survey")
    
    def test_answer_survey_cannot_answer_closed(self):
        """POST /api/surveys/{id}/answer - Cannot answer closed survey"""
        # Create and close survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_AnswerClosed_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Close survey
        self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        
        # Try to answer
        response = self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 0
        })
        
        assert response.status_code == 400
        print("✓ POST /api/surveys/{id}/answer cannot answer closed survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # GET /api/surveys/{id}/results - Get Survey Results
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_get_survey_results(self):
        """GET /api/surveys/{id}/results - Returns results with statistics"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Results_{uuid.uuid4().hex[:8]}",
            "options": ["Opción A", "Opción B", "Opción C"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Get results (admin can see results of active surveys)
        response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}/results")
        
        assert response.status_code == 200
        data = response.json()
        assert "survey" in data
        assert "total_responses" in data
        assert "target_count" in data
        assert "participation_rate" in data
        assert "results" in data
        assert isinstance(data["results"], list)
        
        # Verify results structure
        for result in data["results"]:
            assert "option" in result
            assert "count" in result
            assert "percentage" in result
        
        print(f"✓ GET /api/surveys/{survey_id}/results returns statistics")
    
    def test_get_survey_results_with_answers(self):
        """GET /api/surveys/{id}/results - Returns correct counts after answers"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_ResultsCount_{uuid.uuid4().hex[:8]}",
            "options": ["Sí", "No"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Answer survey
        self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 0
        })
        
        # Get results
        response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}/results")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_responses"] == 1
        
        # Find the option that was selected
        option_0_result = next((r for r in data["results"] if r["option"] == "Sí"), None)
        assert option_0_result is not None
        assert option_0_result["count"] == 1
        
        print(f"✓ GET /api/surveys/{survey_id}/results shows correct answer counts")
    
    def test_get_survey_results_not_found(self):
        """GET /api/surveys/{id}/results - Returns 404 for nonexistent survey"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/surveys/{fake_id}/results")
        
        assert response.status_code == 404
        print("✓ GET /api/surveys/{id}/results returns 404 for nonexistent survey")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Integration Tests
    # ═══════════════════════════════════════════════════════════════════════════
    
    def test_full_survey_workflow(self):
        """Integration: Full survey workflow (Create -> Publish -> Answer -> Results -> Close)"""
        # 1. Create draft survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Workflow_{uuid.uuid4().hex[:8]}",
            "options": ["Excelente", "Bueno", "Regular", "Malo"],
            "target_roles": [],
            "status": "draft"
        })
        assert create_response.status_code == 200
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        print(f"  1. Created draft survey: {survey_id}")
        
        # 2. Publish survey (change to active)
        publish_response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}", json={
            "status": "active"
        })
        assert publish_response.status_code == 200
        assert publish_response.json()["survey"]["status"] == "active"
        print("  2. Published survey (status: active)")
        
        # 3. Answer survey
        answer_response = self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 0  # "Excelente"
        })
        assert answer_response.status_code == 200
        print("  3. Answered survey (option: Excelente)")
        
        # 4. Get results
        results_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}/results")
        assert results_response.status_code == 200
        results = results_response.json()
        assert results["total_responses"] == 1
        print(f"  4. Got results: {results['total_responses']} responses")
        
        # 5. Close survey
        close_response = self.session.put(f"{BASE_URL}/api/surveys/{survey_id}/close")
        assert close_response.status_code == 200
        print("  5. Closed survey")
        
        # 6. Verify final state
        final_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        assert final_response.status_code == 200
        final_survey = final_response.json()
        assert final_survey["status"] == "closed"
        assert final_survey["response_count"] == 1
        print("  6. Verified final state: closed with 1 response")
        
        print("✓ Full survey workflow completed successfully")
    
    def test_survey_appears_in_filtered_list(self):
        """Integration: Created survey appears in filtered list"""
        # Create active survey
        unique_question = f"TEST_Survey_Filter_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": unique_question,
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Get active surveys
        list_response = self.session.get(f"{BASE_URL}/api/surveys", params={"status": "active"})
        surveys = list_response.json()
        
        # Find our survey
        found = any(s["id"] == survey_id for s in surveys)
        assert found, "Created survey not found in active list"
        print("✓ Created survey appears in filtered list")
    
    def test_survey_response_count_updates(self):
        """Integration: Survey response count updates after answer"""
        # Create active survey
        create_response = self.session.post(f"{BASE_URL}/api/surveys", json={
            "question": f"TEST_Survey_Count_{uuid.uuid4().hex[:8]}",
            "options": ["A", "B"],
            "status": "active"
        })
        survey_id = create_response.json()["survey"]["id"]
        self.created_survey_ids.append(survey_id)
        
        # Check initial count
        initial_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        assert initial_response.json()["response_count"] == 0
        
        # Answer survey
        self.session.post(f"{BASE_URL}/api/surveys/{survey_id}/answer", json={
            "option_selected": 0
        })
        
        # Check updated count
        updated_response = self.session.get(f"{BASE_URL}/api/surveys/{survey_id}")
        assert updated_response.json()["response_count"] == 1
        assert updated_response.json()["user_has_responded"] == True
        
        print("✓ Survey response count updates correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
