from django.contrib import admin

from .models import Device, DeviceCommand, SensorReading


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ("id", "temperature", "humidity", "light_level", "created_at")
    readonly_fields = ("id", "created_at")


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "device_type", "desired_state", "reported_state", "last_reported_at")
    readonly_fields = ("id", "created_at", "updated_at", "last_reported_at", "reported_state")


@admin.register(DeviceCommand)
class DeviceCommandAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "action", "status", "created_at", "updated_at", "completed_at")
    list_filter = ("status", "action")
    readonly_fields = ("id", "created_at", "updated_at", "completed_at")
