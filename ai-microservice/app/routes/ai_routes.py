from collections import Counter
from datetime import date, timedelta
import re
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ai", tags=["AI"])


# --- predict-wait -----------------------------------------------------------
# IMPORTANT division of labour:
#   * The NODE backend owns QUEUE PLACEMENT (the 3:1 express rule, positions).
#     It stores each token's position, so the express "skip" is already baked in.
#   * This service therefore does NOT re-derive who is ahead (that would double-
#     count the skip). The caller sends the already-counted "people ahead"; our
#     job is to turn that into a business-aware TIME estimate + a confidence score.
#
# NOTE: this request/response shape is the CONTRACT the Node backend already
# calls (estimateWait sends peopleAhead/emergencyAhead/avgServiceMinutes and reads
# etaMin/etaMax). Do not change it without updating the backend at the same time.

class PredictWaitRequest(BaseModel):
    clinicId: str
    peopleAhead: int              # already counted by Node (from stored positions)
    emergencyAhead: int = 0       # how many of those are emergencies (adds uncertainty)
    avgServiceMinutes: float = 7  # THIS business's per-patient pace (from its DB row)


class PredictWaitResponse(BaseModel):
    peopleAhead: int
    etaMinutes: int
    etaMin: int
    etaMax: int
    confidence: float


@router.post("/predict-wait", response_model=PredictWaitResponse)
def predict_wait(payload: PredictWaitRequest) -> PredictWaitResponse:
    people = max(0, payload.peopleAhead)   # never negative

    eta = round(people * payload.avgServiceMinutes)

    confidence = 0.95 - 0.02 * people - 0.05 * payload.emergencyAhead
    confidence = max(0.5, min(0.95, confidence))

    spread = round(eta * (1 - confidence))
    eta_min = max(0, eta - spread)
    eta_max = eta + spread

    return PredictWaitResponse(
        peopleAhead=people,
        etaMinutes=eta,
        etaMin=eta_min,
        etaMax=eta_max,
        confidence=round(confidence, 2),
    )


# --- verify-emergency -------------------------------------------------------
# ADVISORY ONLY. This NEVER approves or rejects — a human does that (PRD §8.3).
# It returns an urgency score + a recommendation tier + which signals it matched.
# The lowest tier is still "human should review", never "reject".
#
# Rule-based for the MVP (PRD §16). All the scoring is isolated in
# score_emergency() so Phase 2 can swap in an NLP model without changing the API.
#
# NOTE: this response shape (urgencyScore/recommendation/matchedSignals/decision)
# is the CONTRACT the backend stores and the frontend reads. Keep the roman-Urdu
# signals — patients describe emergencies in roman-Urdu.

# High-risk signals — English + roman-Urdu. Each is a strong indicator.
HIGH_RISK_SIGNALS = [
    "chest pain", "heart attack", "stroke", "unconscious", "unresponsive",
    "not breathing", "difficulty breathing", "breathless", "choking",
    "severe bleeding", "bleeding heavily", "seizure", "fit", "accident",
    "overdose", "poisoning", "severe burn", "allergic reaction", "anaphylaxis",
    "paralysis", "collapsed", "labour pain", "labor pain",
    # roman-Urdu
    "dil ka dard", "saans", "saans nahi", "khoon", "behosh", "behoshi",
    "daura", "zeher", "jala", "falij", "chot",
]

# Softer signals — real but lower urgency on their own.
MEDIUM_RISK_SIGNALS = [
    "high fever", "severe pain", "vomiting", "dehydration", "fracture",
    "broken", "dizzy", "fainting",
    # roman-Urdu
    "bukhar", "dard", "ulti", "sar chakrana",
]


class VerifyEmergencyRequest(BaseModel):
    type: str
    description: str


class VerifyEmergencyResponse(BaseModel):
    urgencyScore: float
    recommendation: str            # fast_track | needs_review | insufficient_info
    matchedSignals: List[str]
    reason: str
    decision: str = "human_required"   # constant reminder: AI is never final


def score_emergency(type_field: str, description: str):
    text = (type_field + " " + description).lower()

    high = [s for s in HIGH_RISK_SIGNALS if s in text]
    medium = [s for s in MEDIUM_RISK_SIGNALS if s in text]

    # The dropdown 'type' is a structured signal the user explicitly picked.
    type_selected = bool(type_field.strip()) and type_field.strip().lower() != "other"

    score = 0.0
    if high:
        score += 0.6 + 0.1 * (len(high) - 1)
    if medium:
        score += 0.25 + 0.05 * (len(medium) - 1)
    if type_selected:
        score += 0.2
    score = max(0.0, min(1.0, score))

    matched = high + medium

    # Tier — the lowest is STILL a human review, never a reject.
    if score >= 0.6:
        rec = "fast_track"
        reason = "Strong high-risk signals — recommend prioritising for human approval."
    elif score >= 0.3:
        rec = "needs_review"
        reason = "Some urgency signals present — a human should confirm."
    else:
        rec = "insufficient_info"
        reason = "No clear high-risk signals — a human should still review before deciding."

    return round(score, 2), rec, matched, reason


@router.post("/verify-emergency", response_model=VerifyEmergencyResponse)
def verify_emergency(payload: VerifyEmergencyRequest) -> VerifyEmergencyResponse:
    score, rec, matched, reason = score_emergency(payload.type, payload.description)
    return VerifyEmergencyResponse(
        urgencyScore=score,
        recommendation=rec,
        matchedSignals=matched,
        reason=reason,
    )


# --- chatbot-intent (new — Hiba) --------------------------------------------
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


# --- analyze-feedback + weekly-summary (new — Hiba) -------------------------
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
