"""URL routes for the HomePilot API (all under /api/)."""
from django.urls import path

from . import views

urlpatterns = [
    # Sensor readings
    path(
        "sensors/readings/",
        views.SensorReadingListCreateView.as_view(),
        name="sensorreading-list-create",
    ),
    path(
        "sensors/readings/<uuid:reading_id>/",
        views.SensorReadingDetailView.as_view(),
        name="sensorreading-detail",
    ),
    # Devices + their command log. The literal "commands" route is declared
    # before the "<uuid:device_id>" route for clarity, though the UUID
    # converter would not match the string "commands" anyway.
    path(
        "devices/commands/",
        views.DeviceCommandListView.as_view(),
        name="devicecommand-list-create",
    ),
    path(
        "devices/commands/<uuid:command_id>/result/",
        views.DeviceCommandResultView.as_view(),
        name="devicecommand-result",
    ),
    path(
        "devices/commands/<uuid:command_id>/",
        views.DeviceCommandDetailView.as_view(),
        name="devicecommand-detail",
    ),
    path(
        "devices/<uuid:device_id>/commands/claim/",
        views.DeviceCommandClaimView.as_view(),
        name="devicecommand-claim",
    ),
    path(
        "devices/<uuid:device_id>/state/",
        views.DeviceStateReportView.as_view(),
        name="device-state-report",
    ),
    path(
        "devices/",
        views.DeviceListView.as_view(),
        name="device-list",
    ),
    path(
        "devices/<uuid:device_id>/",
        views.DeviceDetailView.as_view(),
        name="device-detail",
    ),
]
