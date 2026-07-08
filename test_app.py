import os
import json
import unittest

# Point db_io to a test file before importing app to isolate testing from live database
import db_io
db_io.DB_FILE = "test_database.json"

from app import app

class CarePortalTestCase(unittest.TestCase):
    def setUp(self):
        # Establish clean database structure before each test
        self.initial_data = {
            "facilities": [
                {
                    "id": "PHC_TEST",
                    "name": "Test Clinic",
                    "type": "PHC",
                    "beds_capacity": 2,
                    "lat": 0.0,
                    "lon": 0.0,
                    "tests_available": ["Routine Blood"]
                }
            ],
            "users": [
                {"id": "USR_PATIENT1", "name": "Patient One", "role": "Patient", "contact": "", "email": ""},
                {"id": "USR_PATIENT2", "name": "Patient Two", "role": "Patient", "contact": "", "email": ""},
                {"id": "USR_PATIENT3", "name": "Patient Three", "role": "Patient", "contact": "", "email": ""}
            ],
            "staff": [
                {"id": "STF_DOC", "name": "Dr. Tester", "role": "Doctor", "facility_id": "PHC_TEST", "contact": "", "status": "Active"}
            ],
            "admissions": [],
            "inventory": [],
            "attendance_logs": []
        }
        db_io.commit_data(self.initial_data)
        
        # Configure app testing client
        app.config['TESTING'] = True
        self.client = app.test_client()

    def tearDown(self):
        # Remove test database file
        if os.path.exists("test_database.json"):
            os.remove("test_database.json")

    def test_dashboard_stats_role_based(self):
        # Patient view dashboard stats (restricted values)
        response = self.client.get('/api/dashboard-stats', headers={'X-User-Role': 'Patient'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['facilities_count'], 1)
        self.assertEqual(data['staff_count'], 0) # Hidden from Patient
        self.assertEqual(data['users_count'], 0) # Hidden from Patient

        # Admin view dashboard stats (all values visible)
        response = self.client.get('/api/dashboard-stats', headers={'X-User-Role': 'Admin'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['facilities_count'], 1)
        self.assertEqual(data['staff_count'], 1) # Visible to Admin
        self.assertEqual(data['users_count'], 3) # Visible to Admin

    def test_add_facility_permissions(self):
        # Attempting to add facility as a Patient should fail
        response = self.client.post('/api/facilities', 
                                    headers={'X-User-Role': 'Patient'},
                                    json={'name': 'New Clinic', 'beds_capacity': 5})
        self.assertEqual(response.status_code, 403)

        # Attempting as Admin should succeed
        response = self.client.post('/api/facilities', 
                                    headers={'X-User-Role': 'Admin'},
                                    json={'name': 'New Clinic', 'beds_capacity': 5})
        self.assertEqual(response.status_code, 201)
        
        # Verify it was added
        data = db_io.get_data()
        self.assertEqual(len(data['facilities']), 2)

    def test_bed_capacity_validation(self):
        # Admit Patient 1 (under capacity: 1/2 occupied)
        response = self.client.post('/api/admissions',
                                    headers={'X-User-Role': 'Doctor'},
                                    json={'facility_id': 'PHC_TEST', 'user_id': 'USR_PATIENT1', 'reason': 'Fever'})
        self.assertEqual(response.status_code, 201)

        # Admit Patient 2 (at capacity: 2/2 occupied)
        response = self.client.post('/api/admissions',
                                    headers={'X-User-Role': 'Doctor'},
                                    json={'facility_id': 'PHC_TEST', 'user_id': 'USR_PATIENT2', 'reason': 'Cough'})
        self.assertEqual(response.status_code, 201)

        # Admit Patient 3 (exceeds capacity: should reject)
        response = self.client.post('/api/admissions',
                                    headers={'X-User-Role': 'Doctor'},
                                    json={'facility_id': 'PHC_TEST', 'user_id': 'USR_PATIENT3', 'reason': 'Pain'})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Capacity Alert", response.get_json()['description'])

    def test_discharge_patient(self):
        # Admit patient first
        response = self.client.post('/api/admissions',
                                    headers={'X-User-Role': 'Doctor'},
                                    json={'facility_id': 'PHC_TEST', 'user_id': 'USR_PATIENT1', 'reason': 'Fever'})
        adm_id = response.get_json()['id']

        # Discharge patient as Patient role should fail
        response = self.client.post('/api/admissions/discharge',
                                    headers={'X-User-Role': 'Patient'},
                                    json={'id': adm_id})
        self.assertEqual(response.status_code, 403)

        # Discharge as Doctor role should succeed
        response = self.client.post('/api/admissions/discharge',
                                    headers={'X-User-Role': 'Doctor'},
                                    json={'id': adm_id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['status'], 'Discharged')

    def test_inventory_management(self):
        # Patient cannot view inventory
        response = self.client.get('/api/inventory', headers={'X-User-Role': 'Patient'})
        self.assertEqual(response.status_code, 403)

        # Nurse can view and add inventory
        response = self.client.post('/api/inventory',
                                    headers={'X-User-Role': 'Nurse'},
                                    json={'facility_id': 'PHC_TEST', 'item_name': 'Aspirin', 'quantity': 100, 'unit': 'tablets', 'min_required': 20})
        self.assertEqual(response.status_code, 201)

        response = self.client.get('/api/inventory', headers={'X-User-Role': 'Nurse'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()), 1)

    def test_attendance_logging(self):
        # Log attendance as Nurse for Dr. Tester
        response = self.client.post('/api/attendance',
                                    headers={'X-User-Role': 'Nurse'},
                                    json={'staff_id': 'STF_DOC', 'status': 'Present'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()['status'], 'Present')

        # Check out
        response = self.client.post('/api/attendance/checkout',
                                    headers={'X-User-Role': 'Nurse'},
                                    json={'staff_id': 'STF_DOC'})
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.get_json()['check_out'])

    def test_generate_qr_tokens(self):
        # Patient cannot generate tokens
        response = self.client.post('/api/admin/generate-qr-tokens', headers={'X-Active-Role': 'Patient'})
        self.assertEqual(response.status_code, 403)
        
        # Admin can generate tokens
        response = self.client.post('/api/admin/generate-qr-tokens', headers={'X-Active-Role': 'Admin'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("Daily QR Tokens generated successfully", data["message"])
        self.assertIsNotNone(data["facilities"][0].get("daily_qr_token"))

    def test_breach_monitor(self):
        # Patient cannot access breach monitor
        response = self.client.get('/api/admin/breach-monitor', headers={'X-Active-Role': 'Patient'})
        self.assertEqual(response.status_code, 403)
        
        # Add log with violation coordinates (distance from PHC_TEST (0.0, 0.0) is far away)
        self.client.post('/api/attendance',
                          headers={'X-User-Role': 'Nurse'},
                          json={'staff_id': 'STF_DOC', 'status': 'Present', 'device_lat': 1.0, 'device_lon': 1.0})
                          
        response = self.client.get('/api/admin/breach-monitor', headers={'X-Active-Role': 'Admin'})
        self.assertEqual(response.status_code, 200)
        violations = response.get_json()
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]['staff_id'], 'STF_DOC')
        self.assertEqual(violations[0]['status'], 'GEOFENCE_VIOLATION')

    def test_admin_analytics(self):
        # Patient cannot access analytics
        response = self.client.get('/api/admin/analytics', headers={'X-Active-Role': 'Patient'})
        self.assertEqual(response.status_code, 403)
        
        # Admin can access analytics
        response = self.client.get('/api/admin/analytics', headers={'X-Active-Role': 'Admin'})
        self.assertEqual(response.status_code, 200)
        
        data = response.get_json()
        self.assertIn('district_stats', data)
        self.assertIn('facilities_analytics', data)
        self.assertIn('recommendations', data)
        
        stats = data['district_stats']
        self.assertEqual(stats['total_active_staff'], 0) # No staff clocked in today yet in clean DB
        self.assertEqual(stats['cumulative_footfall'], 0)
        
        facs = data['facilities_analytics']
        self.assertEqual(len(facs), 1)
        self.assertEqual(facs[0]['facility_name'], 'Test Clinic')
        self.assertEqual(facs[0]['performance_tier'], 'UNDERPERFORMING_CRITICAL') # Attendance rate is 0.0
        
        # Now clock in the staff member
        self.client.post('/api/attendance',
                         headers={'X-User-Role': 'Nurse'},
                         json={'staff_id': 'STF_DOC', 'status': 'Present'})
                         
        # Fetch analytics again
        response = self.client.get('/api/admin/analytics', headers={'X-Active-Role': 'Admin'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        
        facs = data['facilities_analytics']
        self.assertEqual(facs[0]['performance_tier'], 'OPTIMAL_PERFORMANCE') # Attendance rate is 1.0, low stock is 0, bed strain is 0.0

    def test_pharmacy_management(self):
        # 1. Non-pharmacist/non-admin cannot dispense
        response = self.client.post('/api/dispense',
                                    headers={'X-Active-Role': 'Nurse'},
                                    json={'patient_name': 'John Doe', 'phone': '9999988888', 'medication_id': 'INV_TEST', 'quantity': 5})
        self.assertEqual(response.status_code, 403)

        # 2. Add inventory item first as Admin/Nurse
        self.client.post('/api/inventory',
                         headers={'X-Active-Role': 'Admin'},
                         json={'facility_id': 'PHC_TEST', 'item_name': 'Paracetamol', 'quantity': 100, 'unit': 'tablets', 'min_required': 20})

        # Fetch inventory to get the item ID
        inv_response = self.client.get('/api/inventory', headers={'X-Active-Role': 'Admin'})
        self.assertEqual(inv_response.status_code, 200)
        items = inv_response.get_json()
        self.assertEqual(len(items), 1)
        med_id = items[0]['id']

        # 3. Dispense as Pharmacist
        dispense_response = self.client.post('/api/dispense',
                                            headers={'X-Active-Role': 'Pharmacist'},
                                            json={'patient_name': 'John Doe', 'phone': '9999988888', 'medication_id': med_id, 'quantity': 30})
        self.assertEqual(dispense_response.status_code, 200)
        data = dispense_response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['updated_item']['quantity'], 70)

        # 4. Fetch inventory again to verify updated quantity
        inv_response = self.client.get('/api/inventory', headers={'X-Active-Role': 'Pharmacist'})
        items = inv_response.get_json()
        self.assertEqual(items[0]['quantity'], 70)

        # 5. Dispense quantity greater than stock - should return 400
        dispense_response = self.client.post('/api/dispense',
                                            headers={'X-Active-Role': 'Pharmacist'},
                                            json={'patient_name': 'John Doe', 'phone': '9999988888', 'medication_id': med_id, 'quantity': 80})
        self.assertEqual(dispense_response.status_code, 400)
        self.assertIn("Insufficient Stock Available", dispense_response.get_json()['description'])

        # 6. Log shipment intake
        intake_response = self.client.post('/api/inventory/intake',
                                           headers={'X-Active-Role': 'Pharmacist'},
                                           json={'medication_id': med_id, 'quantity_received': 50, 'batch_number': 'BAT-IN-99', 'expiry_date': '2027-12-31'})
        self.assertEqual(intake_response.status_code, 200)
        intake_data = intake_response.get_json()
        self.assertEqual(intake_data['status'], 'success')
        self.assertEqual(intake_data['updated_item']['quantity'], 120)  # 70 + 50

        # 7. Check low stock alerts route
        alerts_response = self.client.get('/api/inventory/alerts', headers={'X-Active-Role': 'Pharmacist'})
        self.assertEqual(alerts_response.status_code, 200)

        # 8. Check AI Restock forecast route
        forecast_response = self.client.get('/api/inventory/forecast', headers={'X-Active-Role': 'Pharmacist'})
        self.assertEqual(forecast_response.status_code, 200)
        self.assertIn('forecast', forecast_response.get_json())

if __name__ == '__main__':
    unittest.main()
