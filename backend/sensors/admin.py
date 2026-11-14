# from django.contrib import admin

# from .models import Device, SensorReading


# @admin.register(SensorReading)
# class SensorReadingAdmin(admin.ModelAdmin):
#     list_display = ("id", "temperature", "humidity", "light_level", "created_at")
#     readonly_fields = ("id", "created_at")


# @admin.register(Device)
# class DeviceAdmin(admin.ModelAdmin):
#     list_display = (
#         "id",
#         "light_state",
#         "fan_state",
#         "reported_light_state",
#         "reported_fan_state",
#         "revision",
#         "reported_revision",
#         "last_reported_at",
#     )
#     # Reported state and revision come from the hardware, not from an operator.
#     readonly_fields = (
#         "id",
#         "reported_light_state",
#         "reported_fan_state",
#         "reported_revision",
#         "last_reported_at",
#         "created_at",
#         "updated_at",
#     )
