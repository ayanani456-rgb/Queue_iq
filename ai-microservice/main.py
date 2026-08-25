from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()


# --- predict-wait -----------------------------------------------------------
# IMPORTANT division of labour:
#   * The NODE backend owns QUEUE PLACEMENT (the 3:1 express rule, positions).
#     It stores each token's position, so the express "skip" is already baked in.
#   * This service therefore does NOT re-derive who is ahead (that would double-
#     count the skip). The caller sends the already-counted "people ahead"; our
#     job is to turn that into a business-aware TIME estimate + a confidence score.

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


@app.post("/api/ai/predict-wait")
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


@app.post("/api/ai/verify-emergency")
def verify_emergency(payload: VerifyEmergencyRequest) -> VerifyEmergencyResponse:
    score, rec, matched, reason = score_emergency(payload.type, payload.description)
    return VerifyEmergencyResponse(
        urgencyScore=score,
        recommendation=rec,
        matchedSignals=matched,
        reason=reason,
    )
