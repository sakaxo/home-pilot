"""HomePilot sensor and device models.

This app stores everything the single room needs:

* SensorReading -> append-only history of measurements. A new POST always
  creates a new row; nothing is ever overwritten.
* Device        -> the one room controller, which owns a light and a fan.
                   ``light_state`` / ``fan_state`` are what the app *wants*;
                   ``reported_light_state`` / ``reported_fan_state`` are what
                   the hardware actually *reported* (``None`` means "not
                   reported yet", never "off"). ``revision`` increases whenever
                   a desired state changes so the hardware can tell a new
                   request from one it has already applied.
"""
import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


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
    """The single room controller for the light and fan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Desired states (requested by the application)
    light_state = models.BooleanField(default=False)
    fan_state = models.BooleanField(default=False)

    # Actual states (reported by the ESP32)
    reported_light_state = models.BooleanField(null=True, blank=True, default=None)
    reported_fan_state = models.BooleanField(null=True, blank=True, default=None)

    last_reported_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return "Room device"

    @classmethod
    def get_solo(cls):
        device = cls.objects.order_by("created_at").first()
        if device is None:
            device = cls.objects.create()
        return device