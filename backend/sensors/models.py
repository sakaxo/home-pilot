"""HomePilot sensor and device models.

This app stores everything the single room needs:

* SensorReading -> append-only history of measurements. A new POST always
  creates a new row; nothing is ever overwritten.
* Device         -> one row per physical device (currently a light and a fan).
                   It tracks what the app *wants* (desired_state) separately
                   from what the device actually *reports* (reported_state).
* DeviceCommand  -> a log of "please turn on/off" requests. A command starts
                   pending, is claimed once by the device (in_progress), and
                   only becomes confirmed or failed when the device reports the
                   result. ``reported_state`` is never changed by the frontend.
"""
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class DeviceType(models.TextChoices):
    LIGHT = "light", "Light"
    FAN = "fan", "Fan"


class DeviceAction(models.TextChoices):
    TURN_ON = "turn_on", "Turn on"
    TURN_OFF = "turn_off", "Turn off"


class CommandStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In progress"
    CONFIRMED = "confirmed", "Confirmed"
    FAILED = "failed", "Failed"


class SensorReading(models.Model):
    """A single (possibly partial) sensor measurement.

    All sensor values are optional so the device can send whatever it knows.
    A missing value is stored as NULL, which the API returns as ``null``
    ("no reading"), never as a fake ``0``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    temperature = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Temperature in degrees Celsius.",
    )
    humidity = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Relative humidity percentage (0-100).",
    )
    light_level = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Ambient light level (raw sensor units).",
    )
    # Legacy column retained so existing readings and older firmware payloads
    # remain compatible. Motion is not part of the active sensor API.
    motion_detected = models.BooleanField(
        default=False,
        help_text="Whether motion was detected at the time of the reading.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reading at {self.created_at:%Y-%m-%d %H:%M:%S}"


class Device(models.Model):
    """A controllable device in the room.

    ``desired_state``  is what the user asked for in the app.
    ``reported_state`` is what the device last told us. ``None`` means the
    device has never reported anything, i.e. its real state is UNKNOWN --
    it is NOT the same as "off".
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=20, choices=DeviceType.choices, unique=True)
    desired_state = models.BooleanField(default=False)
    reported_state = models.BooleanField(null=True, blank=True, default=None)
    last_reported_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["device_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.device_type})"


class DeviceCommand(models.Model):
    """A request for a device to turn on or off.

    Lifecycle::

        pending -> in_progress -> confirmed | failed

    Every command is created as ``pending``. A device claims it exactly once
    (POST .../commands/claim/), which moves it to ``in_progress``. Only the
    device's execution report can move it to ``confirmed`` or ``failed``.
    There is deliberately no way for a dashboard client to create a command
    that is already completed.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name="commands",
    )
    action = models.CharField(max_length=20, choices=DeviceAction.choices)
    status = models.CharField(
        max_length=20,
        choices=CommandStatus.choices,
        default=CommandStatus.PENDING,
    )
    result_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} -> {self.status}"
