from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


class CreateEventRequest(BaseModel):
    userEmail: str
    clinicName: str
    doctorName: str
    department: str
    appointmentDate: str
    appointmentTime: str
    tokenNumber: int


class EventDetails(BaseModel):
    title: str
    start: str
    end: str
    description: str


class CreateEventResponse(BaseModel):
    success: bool
    googleCalendarLink: str
    icsContent: str
    eventDetails: EventDetails


def parse_appointment_datetime(appointment_date: str, appointment_time: str) -> datetime:
    return datetime.fromisoformat(f"{appointment_date}T{appointment_time}")


def google_calendar_link(title: str, start: datetime, end: datetime, description: str) -> str:
    params = urlencode({
        "action": "TEMPLATE",
        "text": title,
        "dates": f"{start.strftime('%Y%m%dT%H%M%S')}/{end.strftime('%Y%m%dT%H%M%S')}",
        "details": description,
    })
    return f"https://calendar.google.com/calendar/render?{params}"


def ics_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def build_ics(title: str, start: datetime, end: datetime, description: str) -> str:
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//QueueIQ//Calendar//EN",
        "BEGIN:VEVENT",
        f"SUMMARY:{ics_escape(title)}",
        f"DTSTART:{start.strftime('%Y%m%dT%H%M%S')}",
        f"DTEND:{end.strftime('%Y%m%dT%H%M%S')}",
        f"DESCRIPTION:{ics_escape(description)}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ])


@router.post("/create-event", response_model=CreateEventResponse)
def create_event(payload: CreateEventRequest) -> CreateEventResponse:
    start = parse_appointment_datetime(payload.appointmentDate, payload.appointmentTime)
    end = start + timedelta(minutes=30)
    title = f"QueueIQ - {payload.department} Appointment - Token #{payload.tokenNumber}"
    description = (
        f"Clinic: {payload.clinicName}\n"
        f"Doctor: {payload.doctorName}\n"
        f"Token: {payload.tokenNumber}\n"
        "ETA: 18 mins"
    )
    details = EventDetails(
        title=title,
        start=start.isoformat(),
        end=end.isoformat(),
        description=description,
    )
    return CreateEventResponse(
        success=True,
        googleCalendarLink=google_calendar_link(title, start, end, description),
        icsContent=build_ics(title, start, end, description),
        eventDetails=details,
    )


@router.get("/calendar-link")
def calendar_link(
    clinicName: str,
    doctorName: str,
    date: str,
    time: str,
    token: int,
) -> dict[str, str]:
    start = parse_appointment_datetime(date, time)
    end = start + timedelta(minutes=30)
    title = f"QueueIQ Appointment - Token #{token}"
    description = f"Clinic: {clinicName}\nDoctor: {doctorName}\nToken: {token}"
    return {"calendarUrl": google_calendar_link(title, start, end, description)}


class SendCalendarInviteRequest(BaseModel):
    userEmail: str
    appointmentId: str


@router.post("/send-calendar-invite")
def send_calendar_invite(payload: SendCalendarInviteRequest) -> dict[str, object]:
    return {
        "sent": True,
        "message": f"Calendar invite sent to {payload.userEmail}",
    }
