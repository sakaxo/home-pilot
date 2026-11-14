"""Class-based API views for HomePilot.

Only ``APIView`` is used here (no viewsets, no routers) so the small surface
area of this backend stays easy to read.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.fields import DateTimeField
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommandStatus, Device, DeviceAction, DeviceCommand, SensorReading
from .serializers import (
    DeviceCommandResultSerializer,
    DeviceCommandSerializer,
    DeviceDesiredStateSerializer,
    DeviceReportedStateSerializer,
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

    One small query per sensor type (four total) keeps each history series
    independent: a partial reading that only contains, say, light_level does not
    stop the temperature series from finding its own latest value. No fake
    values are inserted -- an empty group has ``current: null`` and an empty
    history.
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


class DeviceListView(APIView):
    """GET all devices in the room."""

    def get(self, request):
        devices = Device.objects.all()
        serializer = DeviceSerializer(devices, many=True)
        return Response(serializer.data)


class DeviceDetailView(APIView):
    """GET one device, or PATCH to change the desired state."""

    def get(self, request, device_id):
        device = get_object_or_404(Device, id=device_id)
        serializer = DeviceSerializer(device)
        return Response(serializer.data)

    def patch(self, request, device_id):
        device = get_object_or_404(Device, id=device_id)

        serializer = DeviceDesiredStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_state = serializer.validated_data["desired_state"]
        action = DeviceAction.TURN_ON if new_state else DeviceAction.TURN_OFF

        with transaction.atomic():
            device.desired_state = new_state
            # NOTE: reported_state is deliberately NOT changed here. Changing
            # what we want is not the same as the device reporting success.
            device.save(update_fields=["desired_state", "updated_at"])
            DeviceCommand.objects.create(device=device, action=action)

        serializer = DeviceSerializer(device)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DeviceStateReportView(APIView):
    """POST the actual state reported by a physical device.

    This is the only endpoint besides a confirmed command result that updates
    ``reported_state``. A dashboard client can never call it on behalf of a
    user click because it represents a device report.
    """

    def post(self, request, device_id):
        device = get_object_or_404(Device, id=device_id)
        serializer = DeviceReportedStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device.reported_state = serializer.validated_data["reported_state"]
        device.last_reported_at = timezone.now()
        device.save(update_fields=["reported_state", "last_reported_at", "updated_at"])

        return Response(DeviceSerializer(device).data)


class DeviceCommandListView(APIView):
    """GET the command log, POST a new command for a real device."""

    def get(self, request):
        limit = _parse_limit(request)
        queryset = DeviceCommand.objects.select_related("device")

        device_id = request.query_params.get("device")
        if device_id:
            queryset = queryset.filter(device__id=device_id)

        command_status = request.query_params.get("status")
        if command_status:
            queryset = queryset.filter(status=command_status)

        commands = queryset.order_by("-created_at")[:limit]
        serializer = DeviceCommandSerializer(commands, many=True)
        return Response(serializer.data)

    def post(self, request):
        device_id = request.data.get("device")
        action = request.data.get("action")

        device = None
        if device_id is not None:
            try:
                device = Device.objects.get(id=device_id)
            except (Device.DoesNotExist, ValidationError, ValueError):
                device = None
        if device is None:
            raise NotFound("Device not found.")

        if action not in DeviceAction.values:
            raise ValidationError({"action": "action must be 'turn_on' or 'turn_off'."})

        command = DeviceCommand.objects.create(device=device, action=action)
        serializer = DeviceCommandSerializer(command)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DeviceCommandClaimView(APIView):
    """Claim the oldest pending command for one device.

    POST is used (not GET) because claiming changes server state. The
    conditional UPDATE is the acknowledgement mechanism: only one request can
    move a command out of ``pending``, so accidental duplicate polls cannot
    execute the same command twice. Returns 204 when nothing is pending.
    """

    def post(self, request, device_id):
        device = get_object_or_404(Device, id=device_id)

        while True:
            command = (
                DeviceCommand.objects.filter(
                    device=device,
                    status=CommandStatus.PENDING,
                )
                .order_by("created_at", "id")
                .first()
            )
            if command is None:
                return Response(status=status.HTTP_204_NO_CONTENT)

            claimed = DeviceCommand.objects.filter(
                id=command.id,
                status=CommandStatus.PENDING,
            ).update(
                status=CommandStatus.IN_PROGRESS,
                updated_at=timezone.now(),
            )
            if claimed:
                command.refresh_from_db()
                return Response(DeviceCommandSerializer(command).data)


class DeviceCommandResultView(APIView):
    """POST the execution result for a command the device has claimed.

    A confirmed result is the device's acknowledgement that it applied the
    action, so it updates ``reported_state``. A failed result leaves the
    reported state unchanged unless the device includes its actual state.
    """

    def post(self, request, command_id):
        serializer = DeviceCommandResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result_status = serializer.validated_data["status"]
        result_message = serializer.validated_data.get("result_message", "")
        has_reported_state = "reported_state" in serializer.validated_data
        reported_state = serializer.validated_data.get("reported_state")

        with transaction.atomic():
            command = DeviceCommand.objects.select_for_update().filter(id=command_id).first()
            if command is None:
                raise NotFound("Command not found.")

            # Retrying the same result is harmless; a different result is not.
            if command.status in (CommandStatus.CONFIRMED, CommandStatus.FAILED):
                if command.status == result_status:
                    return Response(DeviceCommandSerializer(command).data)
                raise ValidationError(
                    {"status": "This command has already completed with a different result."}
                )

            if command.status != CommandStatus.IN_PROGRESS:
                raise ValidationError(
                    {"status": "Claim the command before reporting a result."}
                )

            now = timezone.now()
            updated = DeviceCommand.objects.filter(
                id=command.id,
                status=CommandStatus.IN_PROGRESS,
            ).update(
                status=result_status,
                result_message=result_message,
                completed_at=now,
                updated_at=now,
            )
            if not updated:
                raise ValidationError({"status": "This command is no longer in progress."})

            command.refresh_from_db()
            device = command.device

            if result_status == CommandStatus.CONFIRMED:
                device.reported_state = (
                    reported_state
                    if has_reported_state
                    else command.action == DeviceAction.TURN_ON
                )
                device.last_reported_at = now
                device.save(update_fields=["reported_state", "last_reported_at", "updated_at"])
            elif has_reported_state:
                # A failed action can still tell us what state the device is in.
                device.reported_state = reported_state
                device.last_reported_at = now
                device.save(update_fields=["reported_state", "last_reported_at", "updated_at"])

        return Response(DeviceCommandSerializer(command).data)


class DeviceCommandDetailView(APIView):
    """GET a single command by its UUID."""

    def get(self, request, command_id):
        command = get_object_or_404(DeviceCommand, id=command_id)
        serializer = DeviceCommandSerializer(command)
        return Response(serializer.data)
