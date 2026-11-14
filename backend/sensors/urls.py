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
    # The single room device (a light and a fan).
    path("device/", views.DeviceView.as_view(), name="device"),
    path("device/desired/", views.DeviceDesiredView.as_view(), name="device-desired"),
    path("device/report/", views.DeviceReportView.as_view(), name="device-report"),
]
