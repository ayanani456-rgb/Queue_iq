from collections import Counter
from datetime import date, timedelta
import random
import re
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ai", tags=["AI"])


class PredictWaitRequest(BaseModel):
    clinicId: str
    currentToken: int
    yourToken: int
    queueHistory: List[int] = Field(default_factory=list)


class PredictWaitResponse(BaseModel):
    etaMinutes: int
    peopleAhead: int
    confidence: float


@router.post("/predict-wait", response_model=PredictWaitResponse)
def predict_wait(payload: PredictWaitRequest) -> PredictWaitResponse:
    people_ahead = max(0, payload.yourToken - payload.currentToken)
    eta_minutes = people_ahead * 7 + random.randint(0, 3)
    confidence = round(random.uniform(0.85, 0.98), 2)
    return PredictWaitResponse(
        etaMinutes=eta_minutes,
        peopleAhead=people_ahead,
        confidence=confidence,
    )


class VerifyEmergencyRequest(BaseModel):
    type: str
    description: str


class VerifyEmergencyResponse(BaseModel):
    isRealEmergency: bool
    urgencyScore: float
    reason: str


EMERGENCY_KEYWORDS = [
    "chest pain", "bleeding", "breathing", "unconscious", "stroke", "heart", "bp high"
]


@router.post("/verify-emergency", response_model=VerifyEmergencyResponse)
def verify_emergency(payload: VerifyEmergencyRequest) -> VerifyEmergencyResponse:
    text = f"{payload.type} {payload.description}".lower()
    is_real = any(keyword in text for keyword in EMERGENCY_KEYWORDS) and len(payload.description) > 20
    return VerifyEmergencyResponse(
        isRealEmergency=is_real,
        urgencyScore=0.9 if is_real else 0.3,
        reason="Emergency indicators detected; seek immediate staff attention."
        if is_real
        else "No sufficient emergency indicators detected.",
    )


class ChatbotIntentRequest(BaseModel):
    message: str


class ChatbotIntentResponse(BaseModel):
    date: str
    dept: str
    time: Optional[str]
    original: str


@router.post("/chatbot-intent", response_model=ChatbotIntentResponse)
def chatbot_intent(payload: ChatbotIntentRequest) -> ChatbotIntentResponse:
    text = payload.message.lower()
    today = date.today()
    if "parso" in text:
        appointment_date = today + timedelta(days=2)
    elif "kal" in text or "tomorrow" in text:
        appointment_date = today + timedelta(days=1)
    else:
        appointment_date = today

    department_terms = {
        "dermatology": ("dermatologist", "skin"),
        "cardiology": ("cardio", "heart"),
        "dentistry": ("dentist", "teeth"),
        "ophthalmology": ("eye",),
        "pediatrics": ("child", "bacha"),
    }
    department = "general"
    for name, terms in department_terms.items():
        if any(term in text for term in terms):
            department = name
            break

    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?\b", text)
    appointment_time = None
    if time_match and (time_match.group(3) or "baje" in text[time_match.start():time_match.end() + 5]):
        hour = int(time_match.group(1))
        minutes = time_match.group(2) or "00"
        meridiem = time_match.group(3)
        if meridiem in {"am", "pm"}:
            hour = hour % 12 + (12 if meridiem == "pm" else 0)
        appointment_time = f"{hour:02d}:{minutes}"

    return ChatbotIntentResponse(
        date=appointment_date.isoformat(),
        dept=department,
        time=appointment_time,
        original=payload.message,
    )


class FeedbackItem(BaseModel):
    review: str
    rating: int


class AnalyzeFeedbackRequest(FeedbackItem):
    pass


class AnalyzeFeedbackResponse(BaseModel):
    sentiment: str
    keywords: List[str]
    category: str


FEEDBACK_WORDS = {"long", "bad", "rude", "wait", "worst"}
STOP_WORDS = {
    "the", "and", "was", "were", "with", "this", "that", "very", "for", "from",
    "have", "had", "not", "but", "are", "you", "our", "too", "really", "service",
}


def review_keywords(review: str) -> List[str]:
    words = re.findall(r"[a-zA-Z]+", review.lower())
    counts = Counter(word for word in words if len(word) > 2 and word not in STOP_WORDS)
    return [word for word, _ in counts.most_common(2)]


@router.post("/analyze-feedback", response_model=AnalyzeFeedbackResponse)
def analyze_feedback(payload: AnalyzeFeedbackRequest) -> AnalyzeFeedbackResponse:
    words = set(re.findall(r"[a-zA-Z]+", payload.review.lower()))
    if payload.rating <= 2 or words & FEEDBACK_WORDS:
        sentiment = "negative"
    elif payload.rating >= 4:
        sentiment = "positive"
    else:
        sentiment = "neutral"

    if words & {"wait", "waiting", "time", "staff"}:
        category = "operations"
    elif words & {"doctor", "behavior"}:
        category = "doctor"
    else:
        category = "facility"

    return AnalyzeFeedbackResponse(
        sentiment=sentiment,
        keywords=review_keywords(payload.review),
        category=category,
    )


class WeeklySummaryRequest(BaseModel):
    clinicId: str
    reviews: List[FeedbackItem] = Field(default_factory=list)


class WeeklySummaryResponse(BaseModel):
    topPraise: str
    topComplaint: str
    recommendation: str
    totalReviews: int
    avgRating: float


def common_review_word(reviews: List[FeedbackItem]) -> str:
    words = Counter(
        word
        for item in reviews
        for word in re.findall(r"[a-zA-Z]+", item.review.lower())
        if len(word) > 2 and word not in STOP_WORDS
    )
    return words.most_common(1)[0][0] if words else "none"


@router.post("/weekly-summary", response_model=WeeklySummaryResponse)
def weekly_summary(payload: WeeklySummaryRequest) -> WeeklySummaryResponse:
    positive = [item for item in payload.reviews if item.rating >= 4]
    negative = [item for item in payload.reviews if item.rating <= 2]
    average = sum(item.rating for item in payload.reviews) / len(payload.reviews) if payload.reviews else 0.0
    return WeeklySummaryResponse(
        topPraise=common_review_word(positive),
        topComplaint=common_review_word(negative),
        recommendation="Add more staff Monday 10:00",
        totalReviews=len(payload.reviews),
        avgRating=round(average, 2),
    )
