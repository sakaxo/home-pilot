"""Tests for the HomePilot API."""
import uuid

from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Device, DeviceCommand, DeviceType, SensorReading


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
    def setUp(self):
        call_command("init_devices")
        self.light = Device.objects.get(device_type=DeviceType.LIGHT)
        self.fan = Device.objects.get(device_type=DeviceType.FAN)

    def test_device_init_is_idempotent(self):
        self.assertEqual(Device.objects.count(), 2)
        call_command("init_devices")
        self.assertEqual(Device.objects.count(), 2)

    def test_list_devices(self):
        response = self.client.get("/api/devices/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 2)

    def test_get_shows_desired_and_reported_separately(self):
        self.light.desired_state = True
        self.light.reported_state = None
        self.light.save()

        body = self.client.get(f"/api/devices/{self.light.id}/").json()
        self.assertEqual(body["desired_state"], True)
        self.assertIsNone(body["reported_state"])
        self.assertEqual(body["device_type"], "light")

    def test_patch_changes_desired_and_creates_pending_command(self):
        response = self.client.patch(
            f"/api/devices/{self.light.id}/", {"desired_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.light.refresh_from_db()
        self.assertEqual(self.light.desired_state, True)

        command = DeviceCommand.objects.get()
        self.assertEqual(command.device, self.light)
        self.assertEqual(command.action, "turn_on")
        self.assertEqual(command.status, DeviceCommand._meta.get_field("status").default)

    def test_patch_does_not_change_reported_state(self):
        self.light.reported_state = False
        self.light.save()

        self.client.patch(f"/api/devices/{self.light.id}/", {"desired_state": True}, format="json")

        self.light.refresh_from_db()
        self.assertEqual(self.light.reported_state, False)

    def test_patch_missing_device_is_404(self):
        response = self.client.patch(
            f"/api/devices/{uuid.uuid4()}/", {"desired_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_missing_device_is_404(self):
        response = self.client.get(f"/api/devices/{uuid.uuid4()}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class DeviceCommandTests(APITestCase):
    def setUp(self):
        call_command("init_devices")
        self.light = Device.objects.get(device_type=DeviceType.LIGHT)

    def test_create_command_for_valid_device(self):
        payload = {"device": str(self.light.id), "action": "turn_on"}
        response = self.client.post("/api/devices/commands/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        body = response.json()
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["action"], "turn_on")
        self.assertIn("Living Room Light", body["device"])
        self.assertEqual(body["device_id"], str(self.light.id))

    def test_cannot_create_command_as_confirmed(self):
        payload = {"device": str(self.light.id), "action": "turn_on", "status": "confirmed"}
        response = self.client.post("/api/devices/commands/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], "pending")

    def test_invalid_action_rejected(self):
        payload = {"device": str(self.light.id), "action": "jump"}
        response = self.client.post("/api/devices/commands/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_device_is_404(self):
        payload = {"device": str(uuid.uuid4()), "action": "turn_on"}
        response = self.client.post("/api/devices/commands/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_device_is_404(self):
        response = self.client.post("/api/devices/commands/", {"action": "turn_on"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_and_filter_commands(self):
        self.client.post("/api/devices/commands/", {"device": str(self.light.id), "action": "turn_on"}, format="json")
        self.assertEqual(len(self.client.get("/api/devices/commands/").json()), 1)

        self.assertEqual(len(self.client.get("/api/devices/commands/?status=pending").json()), 1)
        self.assertEqual(len(self.client.get("/api/devices/commands/?status=failed").json()), 0)
        self.assertEqual(
            len(self.client.get(f"/api/devices/commands/?device={self.light.id}").json()), 1
        )

    def test_empty_command_list(self):
        response = self.client.get("/api/devices/commands/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_retrieve_command_by_id(self):
        created = self.client.post(
            "/api/devices/commands/", {"device": str(self.light.id), "action": "turn_off"}, format="json"
        ).json()

        response = self.client.get(f"/api/devices/commands/{created['id']}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["id"], created["id"])

        missing = self.client.get(f"/api/devices/commands/{uuid.uuid4()}/")
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)


class DeviceCommandWorkflowTests(APITestCase):
    """The pending -> in_progress -> confirmed/failed device workflow."""

    def setUp(self):
        call_command("init_devices")
        self.light = Device.objects.get(device_type=DeviceType.LIGHT)
        self.fan = Device.objects.get(device_type=DeviceType.FAN)

    def create_pending(self, action="turn_on", device=None):
        device = device or self.light
        response = self.client.post(
            "/api/devices/commands/",
            {"device": str(device.id), "action": action},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.json()

    def claim(self, device=None):
        device = device or self.light
        return self.client.post(f"/api/devices/{device.id}/commands/claim/")

    def test_claim_marks_oldest_pending_command_in_progress(self):
        first = self.create_pending("turn_on")
        second = self.create_pending("turn_off")

        response = self.claim()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["id"], first["id"])
        self.assertEqual(response.json()["status"], "in_progress")

        # A second poll cannot claim the same command again.
        response = self.claim()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["id"], second["id"])
        self.assertEqual(response.json()["status"], "in_progress")

        # Nothing is left pending.
        self.assertEqual(self.claim().status_code, status.HTTP_204_NO_CONTENT)

    def test_claim_missing_device_is_404(self):
        response = self.client.post(f"/api/devices/{uuid.uuid4()}/commands/claim/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_result_for_missing_command_is_404(self):
        response = self.client.post(
            f"/api/devices/commands/{uuid.uuid4()}/result/",
            {"status": "confirmed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_result_status_is_rejected(self):
        command = self.create_pending("turn_on")
        self.claim()

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "executed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        command_row = DeviceCommand.objects.get(id=command["id"])
        self.assertEqual(command_row.status, "in_progress")

    def test_confirmed_result_updates_reported_state_and_completes_command(self):
        command = self.create_pending("turn_on")
        self.claim()

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "confirmed", "result_message": "Relay switched."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["status"], "confirmed")
        self.assertEqual(body["result_message"], "Relay switched.")
        self.assertIsNotNone(body["completed_at"])

        self.light.refresh_from_db()
        self.assertIs(self.light.reported_state, True)
        self.assertIsNotNone(self.light.last_reported_at)
        # A device result does not silently change the requested state.
        self.assertIs(self.light.desired_state, False)

    def test_confirmed_result_can_use_explicit_reported_state(self):
        command = self.create_pending("turn_on")
        self.claim()

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "confirmed", "reported_state": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.light.refresh_from_db()
        self.assertIs(self.light.reported_state, False)

    def test_failed_result_does_not_change_reported_state(self):
        self.light.reported_state = False
        self.light.save(update_fields=["reported_state"])
        command = self.create_pending("turn_on")
        self.claim()

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "failed", "result_message": "Relay did not respond."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "failed")

        self.light.refresh_from_db()
        self.assertIs(self.light.reported_state, False)

    def test_failed_result_can_report_actual_state(self):
        command = self.create_pending("turn_on")
        self.claim()

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "failed", "reported_state": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.light.refresh_from_db()
        self.assertIs(self.light.reported_state, False)

    def test_result_before_claim_is_rejected(self):
        command = self.create_pending("turn_on")

        response = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "confirmed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        command_row = DeviceCommand.objects.get(id=command["id"])
        self.assertEqual(command_row.status, "pending")

    def test_duplicate_result_is_idempotent_but_conflicting_result_is_rejected(self):
        command = self.create_pending("turn_on")
        self.claim()

        payload = {"status": "confirmed"}
        first = self.client.post(
            f"/api/devices/commands/{command['id']}/result/", payload, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        duplicate = self.client.post(
            f"/api/devices/commands/{command['id']}/result/", payload, format="json"
        )
        self.assertEqual(duplicate.status_code, status.HTTP_200_OK)
        self.assertEqual(duplicate.json()["status"], "confirmed")

        conflicting = self.client.post(
            f"/api/devices/commands/{command['id']}/result/",
            {"status": "failed"},
            format="json",
        )
        self.assertEqual(conflicting.status_code, status.HTTP_400_BAD_REQUEST)

    def test_device_state_report_updates_reported_state_only(self):
        self.light.desired_state = True
        self.light.save(update_fields=["desired_state"])

        response = self.client.post(
            f"/api/devices/{self.light.id}/state/",
            {"reported_state": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.json()["reported_state"], False)

        self.light.refresh_from_db()
        self.assertIs(self.light.reported_state, False)
        self.assertIs(self.light.desired_state, True)
        self.assertIsNotNone(self.light.last_reported_at)

    def test_device_state_report_rejects_missing_or_invalid_state(self):
        response = self.client.post(
            f"/api/devices/{self.light.id}/state/", {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            f"/api/devices/{self.light.id}/state/", {"reported_state": "maybe"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            f"/api/devices/{uuid.uuid4()}/state/", {"reported_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_full_user_command_and_device_acknowledgement_flow(self):
        # 1. The dashboard asks for the light to turn on.
        response = self.client.patch(
            f"/api/devices/{self.light.id}/", {"desired_state": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.json()["desired_state"], True)
        self.assertIsNone(response.json()["reported_state"])

        command = DeviceCommand.objects.get(device=self.light)
        self.assertEqual(command.status, "pending")

        # 2. The device claims the command exactly once.
        claimed = self.claim().json()
        self.assertEqual(claimed["id"], str(command.id))
        self.assertEqual(claimed["status"], "in_progress")

        # 3. The device reports the result.
        self.client.post(
            f"/api/devices/commands/{command.id}/result/",
            {"status": "confirmed"},
            format="json",
        )

        # 4. The dashboard sees the desired and reported state separately.
        body = self.client.get(f"/api/devices/{self.light.id}/").json()
        self.assertIs(body["desired_state"], True)
        self.assertIs(body["reported_state"], True)
        self.assertIsNotNone(body["last_reported_at"])

        self.assertEqual(
            self.client.get(f"/api/devices/commands/{command.id}/").json()["status"],
            "confirmed",
        )


class CorsTests(APITestCase):
    def test_allows_local_frontend_origin(self):
        response = self.client.get("/api/devices/", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:3000")

    def test_blocks_other_origin(self):
        response = self.client.get("/api/devices/", HTTP_ORIGIN="http://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", response)
