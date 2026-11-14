"""Tests for the HomePilot API."""
import uuid

from rest_framework import status
from rest_framework.test import APITestCase

from .models import Device, SensorReading


class SensorReadingTests(APITestCase):
    def test_empty_list_returns_empty_groups_without_fake_values(self):
        response = self.client.get("/api/sensors/readings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        body = response.json()
        self.assertEqual(set(body), {"temperature", "humidity", "light"})
        for key, unit in (
            ("temperature", "°C"),
            ("humidity", "%"),
            ("light", "raw"),
        ):
            self.assertEqual(body[key]["unit"], unit)
            self.assertIsNone(body[key]["current"])
            self.assertIsNone(body[key]["timestamp"])
            self.assertEqual(body[key]["history"], [])

    def test_post_saves_reading(self):
        payload = {
            "temperature": 22.5,
            "humidity": 48.0,
            "light_level": 512,
            "motion_detected": False,
        }
        response = self.client.post("/api/sensors/readings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        body = response.json()
        self.assertIn("id", body)
        self.assertIn("created_at", body)
        self.assertEqual(float(body["temperature"]), 22.5)
        self.assertEqual(float(body["humidity"]), 48.0)
        self.assertEqual(body["light_level"], 512)
        # The legacy motion field is accepted from older firmware but is not
        # part of the active sensor response.
        self.assertNotIn("motion_detected", body)
        self.assertEqual(SensorReading.objects.count(), 1)

    def test_post_allows_partial_reading(self):
        response = self.client.post("/api/sensors/readings/", {"light_level": 700}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertIsNone(body["temperature"])
        self.assertIsNone(body["humidity"])
        self.assertEqual(body["light_level"], 700)

    def test_invalid_humidity_rejected(self):
        response = self.client.post("/api/sensors/readings/", {"humidity": 150}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post("/api/sensors/readings/", {"humidity": -5}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_groups_readings_chronologically(self):
        for i in range(3):
            self.client.post("/api/sensors/readings/", {"light_level": i}, format="json")

        body = self.client.get("/api/sensors/readings/").json()
        light = body["light"]

        self.assertEqual(light["unit"], "raw")
        self.assertEqual(light["current"], 2)
        self.assertEqual([point["value"] for point in light["history"]], [0, 1, 2])
        self.assertEqual(light["timestamp"], light["history"][-1]["timestamp"])
        timestamps = [point["timestamp"] for point in light["history"]]
        self.assertEqual(timestamps, sorted(timestamps))

        # Temperature and humidity were never supplied, so they stay empty.
        self.assertIsNone(body["temperature"]["current"])
        self.assertEqual(body["temperature"]["history"], [])
        self.assertIsNone(body["humidity"]["current"])
        self.assertEqual(body["humidity"]["history"], [])

    def test_partial_readings_keep_series_independent(self):
        self.client.post("/api/sensors/readings/", {"temperature": 20.5}, format="json")
        self.client.post("/api/sensors/readings/", {"humidity": 45.5}, format="json")
        self.client.post("/api/sensors/readings/", {"light_level": 700}, format="json")

        body = self.client.get("/api/sensors/readings/").json()

        self.assertIsInstance(body["temperature"]["current"], float)
        self.assertEqual(body["temperature"]["current"], 20.5)
        self.assertEqual(len(body["temperature"]["history"]), 1)

        self.assertIsInstance(body["humidity"]["current"], float)
        self.assertEqual(body["humidity"]["current"], 45.5)
        self.assertEqual(len(body["humidity"]["history"]), 1)

        self.assertIsInstance(body["light"]["current"], int)
        self.assertEqual(body["light"]["current"], 700)
        self.assertEqual(len(body["light"]["history"]), 1)

    def test_legacy_motion_submission_is_ignored_but_accepted(self):
        # Older firmware may still include motion_detected. It must not break
        # the submission endpoint or appear in the active sensor response.
        response = self.client.post(
            "/api/sensors/readings/",
            {"temperature": 21.0, "motion_detected": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("motion_detected", response.json())

        body = self.client.get("/api/sensors/readings/").json()
        self.assertEqual(set(body), {"temperature", "humidity", "light"})
        self.assertEqual(body["temperature"]["current"], 21.0)

    def test_limit_is_applied_and_clamped(self):
        for i in range(3):
            self.client.post("/api/sensors/readings/", {"light_level": i}, format="json")

        self.assertEqual(
            len(self.client.get("/api/sensors/readings/?limit=1").json()["light"]["history"]), 1
        )
        # A huge limit is clamped to the max of 50, not an error.
        self.assertEqual(
            len(self.client.get("/api/sensors/readings/?limit=9999").json()["light"]["history"]),
            3,
        )
        # A non-numeric limit is a 400.
        self.assertEqual(
            self.client.get("/api/sensors/readings/?limit=abc").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_detail_by_uuid(self):
        created = self.client.post("/api/sensors/readings/", {"light_level": 5}, format="json").json()
        response = self.client.get(f"/api/sensors/readings/{created['id']}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["id"], created["id"])

        missing = self.client.get(f"/api/sensors/readings/{uuid.uuid4()}/")
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)


class DeviceTests(APITestCase):
    """The single room device, its desired/reported states and its revision."""

    def setUp(self):
        self.device = Device.get_solo()

    def test_device_is_created_on_first_use(self):
        self.assertEqual(Device.objects.count(), 1)
        response = self.client.get("/api/device/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Device.objects.count(), 1)

    def test_get_returns_desired_and_reported_separately(self):
        self.device.light_state = True
        self.device.reported_light_state = None
        self.device.save()

        body = self.client.get("/api/device/").json()
        self.assertIs(body["light_state"], True)
        self.assertIsNone(body["reported_light_state"])
        self.assertIsNone(body["reported_fan_state"])

    def test_patch_updates_light_desired_state(self):
        response = self.client.patch("/api/device/", {"light_state": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.device.refresh_from_db()
        self.assertIs(self.device.light_state, True)
        self.assertIs(self.device.fan_state, False)

    def test_patch_updates_fan_desired_state(self):
        response = self.client.patch("/api/device/", {"fan_state": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.device.refresh_from_db()
        self.assertIs(self.device.fan_state, True)

    def test_patch_can_update_both_states_at_once(self):
        response = self.client.patch(
            "/api/device/", {"light_state": True, "fan_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.device.refresh_from_db()
        self.assertIs(self.device.light_state, True)
        self.assertIs(self.device.fan_state, True)

    def test_patch_does_not_change_reported_state(self):
        self.device.reported_light_state = False
        self.device.reported_fan_state = True
        self.device.save()

        self.client.patch("/api/device/", {"light_state": True, "fan_state": False}, format="json")

        self.device.refresh_from_db()
        self.assertIs(self.device.reported_light_state, False)
        self.assertIs(self.device.reported_fan_state, True)

    def test_patch_increments_revision_on_change(self):
        self.assertEqual(self.device.revision, 0)

        self.client.patch("/api/device/", {"light_state": True}, format="json")
        self.device.refresh_from_db()
        self.assertEqual(self.device.revision, 1)

        self.client.patch("/api/device/", {"fan_state": True}, format="json")
        self.device.refresh_from_db()
        self.assertEqual(self.device.revision, 2)

    def test_patch_same_value_does_not_change_revision(self):
        self.client.patch("/api/device/", {"light_state": True}, format="json")
        self.device.refresh_from_db()
        self.assertEqual(self.device.revision, 1)

        # Sending the state it already has is a no-op.
        response = self.client.patch("/api/device/", {"light_state": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.device.refresh_from_db()
        self.assertEqual(self.device.revision, 1)

    def test_patch_requires_a_state_field(self):
        response = self.client.patch("/api/device/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_rejects_non_boolean(self):
        response = self.client.patch("/api/device/", {"light_state": "maybe"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_ignores_reported_fields(self):
        response = self.client.patch(
            "/api/device/",
            {"light_state": True, "reported_light_state": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.device.refresh_from_db()
        self.assertIs(self.device.light_state, True)
        self.assertIsNone(self.device.reported_light_state)

    def test_desired_endpoint_returns_states_and_revision(self):
        self.device.light_state = True
        self.device.revision = 3
        self.device.save()

        body = self.client.get("/api/device/desired/").json()
        self.assertEqual(set(body), {"light_state", "fan_state", "revision"})
        self.assertIs(body["light_state"], True)
        self.assertIs(body["fan_state"], False)
        self.assertEqual(body["revision"], 3)

    def test_report_updates_reported_states_and_revision(self):
        response = self.client.post(
            "/api/device/report/",
            {"reported_light_state": True, "reported_fan_state": False, "revision": 2},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.device.refresh_from_db()
        self.assertIs(self.device.reported_light_state, True)
        self.assertIs(self.device.reported_fan_state, False)
        self.assertEqual(self.device.reported_revision, 2)
        self.assertIsNotNone(self.device.last_reported_at)

    def test_report_can_update_one_state(self):
        self.device.reported_fan_state = True
        self.device.save()

        response = self.client.post(
            "/api/device/report/", {"reported_light_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.device.refresh_from_db()
        self.assertIs(self.device.reported_light_state, True)
        self.assertIs(self.device.reported_fan_state, True)

    def test_report_does_not_change_desired_state(self):
        self.device.light_state = False
        self.device.save()

        self.client.post("/api/device/report/", {"reported_light_state": True}, format="json")

        self.device.refresh_from_db()
        self.assertIs(self.device.light_state, False)

    def test_report_requires_a_state(self):
        response = self.client.post("/api/device/report/", {"revision": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_rejects_invalid_values(self):
        response = self.client.post(
            "/api/device/report/", {"reported_light_state": "maybe"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/device/report/", {"reported_light_state": True, "revision": -1}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_request_and_acknowledgement_flow(self):
        # 1. The dashboard asks for the light to turn on.
        response = self.client.patch("/api/device/", {"light_state": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.json()["light_state"], True)
        self.assertIsNone(response.json()["reported_light_state"])
        revision = response.json()["revision"]
        self.assertEqual(revision, 1)

        # 2. The hardware reads the desired states and the current revision.
        desired = self.client.get("/api/device/desired/").json()
        self.assertIs(desired["light_state"], True)
        self.assertEqual(desired["revision"], revision)

        # 3. The hardware applies the change and reports back.
        self.client.post(
            "/api/device/report/",
            {"reported_light_state": True, "reported_fan_state": False, "revision": revision},
            format="json",
        )

        # 4. The dashboard sees the desired and reported states agree.
        body = self.client.get("/api/device/").json()
        self.assertIs(body["light_state"], True)
        self.assertIs(body["reported_light_state"], True)
        self.assertEqual(body["reported_revision"], revision)


class CorsTests(APITestCase):
    def test_allows_local_frontend_origin(self):
        response = self.client.get("/api/device/", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:3000")

    def test_blocks_other_origin(self):
        response = self.client.get("/api/device/", HTTP_ORIGIN="http://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", response)
