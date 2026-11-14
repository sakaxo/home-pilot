"""Serializers for the HomePilot API.

Every serializer keeps server-managed fields (IDs, timestamps, device-reported
state, command status) read-only so a client can never forge them.
"""
from rest_framework import serializers

from .models import CommandStatus, Device, DeviceCommand, SensorReading


class SensorReadingSerializer(serializers.ModelSerializer):
    """A single sensor measurement.

    All active sensor values are optional; any subset can be sent. The legacy
    ``motion_detected`` column is intentionally not exposed here. DRF ignores
    unknown input fields, so older firmware that still submits it keeps working
    without affecting the three active sensors.
    """

    class Meta:
        model = SensorReading
        fields = ["id", "temperature", "humidity", "light_level", "created_at"]
        read_only_fields = ["id", "created_at"]


class DeviceSerializer(serializers.ModelSerializer):
    """Read view of a device.

    ``desired_state`` and ``reported_state`` are returned as separate fields so
    the client can always tell "what we asked for" from "what the device says".
    ``reported_state`` is read-only: clients can never fake a device report.
    """

    class Meta:
        model = Device
        fields = [
            "id",
            "name",
            "device_type",
            "desired_state",
            "reported_state",
            "last_reported_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reported_state",
            "last_reported_at",
            "created_at",
            "updated_at",
        ]


class DeviceDesiredStateSerializer(serializers.Serializer):
    """Accepts only a change to the desired state for a PATCH."""

    desired_state = serializers.BooleanField(required=True)


class DeviceReportedStateSerializer(serializers.Serializer):
    """Accepts an actual state report from a physical device."""

    reported_state = serializers.BooleanField(required=True)


class DeviceCommandResultSerializer(serializers.Serializer):
    """Accepts the execution result reported by a physical device.

    ``reported_state`` is optional because a device may report its state
    separately through the device state endpoint.
    """

    status = serializers.ChoiceField(
        choices=[CommandStatus.CONFIRMED, CommandStatus.FAILED],
        required=True,
    )
    result_message = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
    )
    reported_state = serializers.BooleanField(required=False)


class DeviceCommandSerializer(serializers.ModelSerializer):
    """A turn on/off command.

    ``status`` is read-only so a client cannot create a command that is already
    confirmed or failed -- every new command starts as ``pending``.

    ``device`` keeps returning the human-readable device name for backwards
    compatibility, while ``device_id`` gives clients the stable UUID they need
    to attach the command to the matching device.
    """

    device = serializers.StringRelatedField(read_only=True)
    device_id = serializers.UUIDField(source="device.id", read_only=True)

    class Meta:
        model = DeviceCommand
        fields = [
            "id",
            "device",
            "device_id",
            "action",
            "status",
            "result_message",
            "created_at",
            "updated_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "device",
            "device_id",
            "status",
            "result_message",
            "created_at",
            "updated_at",
            "completed_at",
        ]
