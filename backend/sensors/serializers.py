"""Serializers for the HomePilot API.

Every serializer keeps server-managed fields (IDs, timestamps, hardware-reported
state and revision) read-only so a dashboard client can never forge them.
"""
from rest_framework import serializers

from .models import Device, SensorReading


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
    class Meta:
        model = Device
        fields = [
            "id",
            "light_state",
            "fan_state",
            "reported_light_state",
            "reported_fan_state",
            "last_reported_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

class DeviceDesiredUpdateSerializer(serializers.Serializer):
    """Accepts a desired-state change for the light and/or the fan.

    Only the fields that are sent are changed. ``reported_*`` is never accepted
    here: a request from the app is not a hardware report.
    """

    light_state = serializers.BooleanField(required=False)
    fan_state = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if "light_state" not in attrs and "fan_state" not in attrs:
            raise serializers.ValidationError(
                "Provide light_state and/or fan_state."
            )
        return attrs


class DeviceDesiredStateSerializer(serializers.Serializer):
    light_state = serializers.BooleanField()
    fan_state = serializers.BooleanField()

class DeviceReportSerializer(serializers.Serializer):
    reported_light_state = serializers.BooleanField(required=False)
    reported_fan_state = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if (
            "reported_light_state" not in attrs
            and "reported_fan_state" not in attrs
        ):
            raise serializers.ValidationError(
                "Provide reported_light_state and/or reported_fan_state."
            )
        return attrs