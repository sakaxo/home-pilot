"""Create the default devices (one light and one fan) if they don't exist.

This command is idempotent: running it any number of times will not create
duplicates and will not reset any state that already exists.

Usage:
    python manage.py init_devices
"""
from django.core.management.base import BaseCommand

from sensors.models import Device, DeviceType

DEFAULT_DEVICES = [
    {"name": "Living Room Light", "device_type": DeviceType.LIGHT},
    {"name": "Living Room Fan", "device_type": DeviceType.FAN},
]


class Command(BaseCommand):
    help = "Create the default light and fan devices (safe to run repeatedly)."

    def handle(self, *args, **options):
        for spec in DEFAULT_DEVICES:
            device, created = Device.objects.get_or_create(
                device_type=spec["device_type"],
                defaults={"name": spec["name"]},
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created device "{device.name}" ({device.device_type}).')
                )
            else:
                self.stdout.write(
                    f'Device "{device.name}" ({device.device_type}) already exists -- skipping.'
                )
