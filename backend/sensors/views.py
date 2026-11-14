"""Class-based API views for HomePilot.

Only ``APIView`` is used here (no viewsets, no routers) so the small surface
area of this backend stays easy to read.
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.fields import DateTimeField
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Device, SensorReading
from .serializers import (
    DeviceDesiredStateSerializer,
    DeviceDesiredUpdateSerializer,
    DeviceReportSerializer,
    DeviceSerializer,
    SensorReadingSerializer,
)

DEFAULT_LIMIT = 20
MAX_LIMIT = 50

# Each group maps the API key to the SensorReading field and the unit the
# frontend should display. Only the three active sensors are exposed.
SENSOR_GROUPS = (
    ("temperature", "temperature", "°C"),
    ("humidity", "humidity", "%"),
    ("light", "light_level", "raw"),
)

_DATETIME_FIELD = DateTimeField()


def _parse_limit(request):
    """Read and clamp the ``limit`` query parameter (default 20, max 50)."""
    raw = request.query_params.get("limit")
    if raw is None:
        return DEFAULT_LIMIT
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        raise ValidationError({"limit": "limit must be an integer."})
    if limit < 1:
        raise ValidationError({"limit": "limit must be a positive integer."})
    return min(limit, MAX_LIMIT)


def _serialize_sensor_value(field, value):
    """Return the sensor value with the type the frontend should consume."""
    if field in ("temperature", "humidity"):
        return float(value)
    return int(value)


def _serialize_timestamp(value):
    """Serialize a timestamp exactly like the rest of the API (ISO 8601)."""
    return _DATETIME_FIELD.to_representation(value)


def _build_sensor_groups(limit):
    """Group the most recent readings by sensor type.

    One small query per sensor type keeps each history series independent: a
    partial reading that only contains, say, light_level does not stop the
    temperature series from finding its own latest value. No fake values are
    inserted -- an empty group has ``current: null`` and an empty history.
    """
    groups = {}

    for key, field, unit in SENSOR_GROUPS:
        rows = (
            SensorReading.objects.exclude(**{f"{field}__isnull": True})
            .order_by("-created_at")
            .values_list("created_at", field)[:limit]
        )

        history = [
            {
                "value": _serialize_sensor_value(field, value),
                "timestamp": _serialize_timestamp(created_at),
            }
            for created_at, value in reversed(list(rows))
        ]
        latest = history[-1] if history else None

        groups[key] = {
            "unit": unit,
            "current": latest["value"] if latest else None,
            "timestamp": latest["timestamp"] if latest else None,
            "history": history,
        }

    return groups


class SensorReadingListCreateView(APIView):
    """GET readings grouped by sensor type, POST a new reading.

    GET response shape::

        {
          "temperature": {
            "unit": "°C",
            "current": 27.57,
            "timestamp": "2026-10-26T00:59:09.848174Z",
            "history": [{"value": 22.62, "timestamp": "..."}]
          },
          "humidity": {...},
          "light": {"unit": "raw", ...}
        }

    ``history`` is chronological (oldest first) and contains at most ``limit``
    readings. POST behaviour is unchanged: every request appends a new row.
    """

    def get(self, request):
        limit = _parse_limit(request)
        return Response(_build_sensor_groups(limit))

    def post(self, request):
        serializer = SensorReadingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SensorReadingDetailView(APIView):
    """GET a single reading by its UUID."""

    def get(self, request, reading_id):
        reading = get_object_or_404(SensorReading, id=reading_id)
        serializer = SensorReadingSerializer(reading)
        return Response(serializer.data)


class DeviceView(APIView):
    """GET device states and PATCH desired light/fan states."""

    def get(self, request):
        device = Device.get_solo()
        return Response(DeviceSerializer(device).data)

    def patch(self, request):
        serializer = DeviceDesiredUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device = Device.get_solo()
        updates = serializer.validated_data

        if "light_state" in updates:
            device.light_state = updates["light_state"]

        if "fan_state" in updates:
            device.fan_state = updates["fan_state"]

        device.save(update_fields=[
            "light_state",
            "fan_state",
            "updated_at",
        ])

        return Response(DeviceSerializer(device).data)


class DeviceDesiredView(APIView):
    """GET desired light and fan states for the ESP32."""

    def get(self, request):
        device = Device.get_solo()
        return Response(DeviceDesiredStateSerializer(device).data)

class DeviceReportView(APIView):
    """POST actual light and fan states reported by the ESP32."""

    def post(self, request):
        serializer = DeviceReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device = Device.get_solo()
        report = serializer.validated_data

        update_fields = ["last_reported_at", "updated_at"]

        if "reported_light_state" in report:
            device.reported_light_state = report["reported_light_state"]
            update_fields.append("reported_light_state")

        if "reported_fan_state" in report:
            device.reported_fan_state = report["reported_fan_state"]
            update_fields.append("reported_fan_state")

        device.last_reported_at = timezone.now()
        device.save(update_fields=update_fields)

        return Response(DeviceSerializer(device).data)