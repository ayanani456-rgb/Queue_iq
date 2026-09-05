# QueueIQ Repository Audit Report

**Date:** September 5, 2026  
**Auditor:** Copilot CLI  
**Repository:** ayanani456-rgb/Queue_iq  
**Branch:** hibashaukat-repo-audit-and-bugs

---

## Executive Summary

Repository contains **BACKEND**, **FRONTEND**, and **AI MICROSERVICE**. Audit found **11 critical/major issues** across security, logic, API design, and type safety areas. All are fixable within current architecture.

---

## BACKEND APIs (Actually Exist)

✅ **BOOKING APIS** (`/api/tokens`)
- `POST /api/tokens/book` — Book normal/express/emergency token
- `GET /api/tokens/status/:token` — Get token status
- `GET /api/tokens/mine?clientId=…` — Get all client's tokens
- `POST /api/bookings/:id/cancel` — Cancel token

✅ **BUSINESS/STAFF APIs** (`/api/business`) - Require JWT Auth
- `GET /api/business/tokens?doctorId=…` — Get doctor's queue
- `POST /api/business/call-next` — Call next patient
- `POST /api/business/complete` — Mark visit done
- `POST /api/business/approve-emergency` — Approve/reject emergency

✅ **AUTH APIS** (`/api/auth`)
- `POST /api/auth/login` — Staff login (returns JWT)

✅ **WHATSAPP APIs** (`/api/whatsapp`)
- `GET /api/whatsapp/webhook` — Health check + Meta handshake
- `POST /api/whatsapp/webhook` — Incoming messages (confirmation + bot)
- `POST /api/whatsapp/status` — Message delivery receipts
- `POST /api/whatsapp/send` — Send WhatsApp message

---

## ISSUES FOUND

### 🔴 CRITICAL ISSUES

#### 1. **Hardcoded Test WhatsApp Message in booking.routes.js**
- **File:** `backend/src/routes/booking.routes.js:19-22`
- **Severity:** HIGH
- **Issue:** Console log message every booking instead of proper route handling
```javascript
router.post('/book', (req, res) => {
    console.log('WhatsApp integration OK - Backend connected'); // ❌ WRONG
    return bookToken(req, res);
});
```
- **Impact:** Pollutes logs, misleading message
- **Fix:** Remove the console.log

---

#### 2. **Hard-Coded Time Display in ChatWindow Component**
- **File:** `frontend/src/components/WhatsAppBot/ChatWindow.tsx:86`
- **Severity:** MEDIUM
- **Issue:** Chat messages always show "12:14 PM" regardless of actual time
```javascript
<p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
    12:14 PM  {/* ❌ Hard-coded time */}
```
- **Impact:** Users see incorrect message timestamps
- **Fix:** Use `new Date(item.time).toLocaleTimeString()`

---

#### 3. **API Endpoints in Frontend Service Don't Match Backend Routes**
- **File:** `frontend/src/services/whatsappService.ts`
- **Severity:** CRITICAL
- **Issues:**
  - Line 24: `/api/doctors?hospital=...` — **❌ DOESN'T EXIST in backend**
  - Line 37: `/api/queue/status?doctorId=...` — **❌ WRONG; should be `/api/business/tokens?doctorId=...`**
  - Line 49: `/api/tokens/generate` — **❌ DOESN'T EXIST; should be `/api/tokens/book`**
  
```javascript
// ❌ WRONG ENDPOINTS
async getLiveDoctors(hospital?: string, speciality?: string) {
    // Backend has NO /api/doctors endpoint
    const response = await fetch(
        `${API_BASE}/api/doctors?hospital=${hospital}&speciality=${speciality}`,
    );
}

async getQueueStatus(doctorId: string) {
    // ❌ WRONG - should be /api/business/tokens?doctorId=...
    const response = await fetch(
        `${API_BASE}/api/queue/status?doctorId=${doctorId}`,
    );
}

async generateToken(doctorId: string, phone: string, type: string) {
    // ❌ WRONG - should be /api/tokens/book with POST
    const response = await fetch(`${API_BASE}/api/tokens/generate`, {
```
- **Impact:** Frontend will FAIL with 404 errors when calling these methods
- **Fix:** Update endpoint URLs to match actual backend routes

---

#### 4. **Missing Error Handling in API Responses**
- **File:** `frontend/src/services/whatsappService.ts:14, 27, 40, 57`
- **Severity:** HIGH
- **Issue:** Returns response.json() without checking if response is OK first
```javascript
async sendMessage(phone: string, message: string) {
    const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
        // ...
    });
    return response.json();  // ❌ Doesn't check if response.ok
}
```
- **Impact:** Returns error responses as success, app logic breaks
- **Fix:** Check `response.ok` before parsing JSON, throw on error

---

#### 5. **JWT Secret is Hardcoded in Development**
- **File:** `backend/src/config/jwt.js:14`
- **Severity:** CRITICAL (for production)
- **Issue:**
```javascript
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    JWT_SECRET = 'dev-insecure-jwt-secret-change-me';  // ❌ Public fallback
```
- **Impact:** Any production deployment without env var will use a known secret
- **Fix:** Force production to error if JWT_SECRET not set

---

### 🟠 MAJOR ISSUES

#### 6. **Race Condition in Queue Renumbering**
- **File:** `backend/src/controllers/booking.controller.js:108-110`
- **Severity:** MEDIUM-HIGH
- **Issue:** Queue is modified and set without atomic operations
```javascript
queue.splice(idx, 0, row);  // Insert at position
renumber(queue);             // Re-number positions
await setQueue(queue);        // Write back
// ❌ Another request could change queue between splice and setQueue
```
- **Impact:** Concurrent bookings might get duplicate positions or skip numbers
- **Fix:** Implement database-level locking or use atomic transactions

---

#### 7. **No Input Validation for Doctor ID in Backend**
- **File:** `backend/src/controllers/booking.controller.js:102`
- **Severity:** MEDIUM
- **Issue:** nextTokenNumber() doesn't take doctorId, uses global counter
```javascript
const token = await nextTokenNumber();  // ❌ Shared across all doctors
// Later: tokens from different doctors could have same number
```
- **Impact:** Token collisions possible across different doctor queues
- **Fix:** Make token numbers per-doctor or add doctor prefix

---

#### 8. **Missing Redis Connection Error Handling**
- **File:** `backend/src/app.js:64`
- **Severity:** MEDIUM
- **Issue:** Redis connection failure only logs, doesn't halt startup
```javascript
connectRedis().catch((error) => console.error('Redis connection failed', error));
// ❌ App continues without Redis, features expecting it will fail silently
```
- **Impact:** Caching expected but not available, poor performance
- **Fix:** Either require Redis or remove it

---

#### 9. **CORS Configuration Too Permissive with Regex**
- **File:** `backend/src/app.js:24`
- **Severity:** MEDIUM
- **Issue:** Vercel regex allows any subdomain to access API
```javascript
|| /^https:\/\/[^/]+\.vercel\.app$/.test(origin)  // ❌ Allows attacker.vercel.app
```
- **Impact:** Anyone can deploy to Vercel and call the API
- **Fix:** Use exact domain match instead of blanket regex

---

#### 10. **No Pagination/Limit on getTokensByClient**
- **File:** `backend/src/controllers/booking.controller.js:225`
- **Severity:** LOW-MEDIUM
- **Issue:** Clients can fetch unlimited tokens, no pagination
```javascript
async function getMyTokens(req, res) {
    const mine = await getTokensByClient(clientId);  // ❌ No limit
    // If a client booked 10,000 tokens, all returned
```
- **Impact:** Large response sizes, poor performance for active clients
- **Fix:** Add limit/offset pagination

---

#### 11. **Type Safety Issues in Frontend**
- **File:** `frontend/src/services/whatsappService.ts`
- **Severity:** LOW
- **Issue:** Missing `async/await` error handling, response types not validated
- **Impact:** TypeScript won't catch API contract violations at compile time
- **Fix:** Add proper response types/interfaces, validate with Zod/io-ts

---

## FOLDER STRUCTURE SUMMARY

```
Queue_iq/
├── backend/                          # Node.js/Express API
│   ├── src/
│   │   ├── app.js                    # Entry point ✓ FOUND ISSUES
│   │   ├── startAi.js                # AI microservice launcher
│   │   ├── config/
│   │   │   ├── jwt.js                # ✓ FOUND ISSUE #5 (hardcoded secret)
│   │   │   └── redis.js              # ✓ FOUND ISSUE #8 (no error handling)
│   │   ├── controllers/
│   │   │   ├── booking.controller.js # ✓ FOUND ISSUES #6, #7, #10
│   │   │   └── business.controller.js # Well-structured ✓
│   │   ├── logic/
│   │   │   └── queueLogic.js         # Clean implementation ✓
│   │   ├── data/
│   │   │   ├── queueStore.js         # In-memory store
│   │   │   └── queueStore.supabase.js # Supabase adapter
│   │   ├── middleware/
│   │   │   └── auth.js               # JWT auth ✓
│   │   ├── routes/
│   │   │   ├── booking.routes.js     # ✓ FOUND ISSUE #1 (hardcoded message)
│   │   │   └── business.routes.js    # ✓
│   │   └── services/
│   │       └── whatsapp.service.js   # Vonage API integration ✓
│   ├── db/
│   │   └── schema.sql                # Schema reference
│   ├── package.json                  # ✓
│   └── .env.example
│
├── frontend/                         # Next.js + React
│   ├── src/
│   │   ├── components/
│   │   │   └── WhatsAppBot/
│   │   │       └── ChatWindow.tsx    # ✓ FOUND ISSUES #2, #4
│   │   └── services/
│   │       └── whatsappService.ts    # ✓ FOUND ISSUES #3, #4
│   ├── package.json                  # ✓
│   └── .env.example
│
└── ai-microservice/                  # Python FastAPI
    ├── app/
    │   └── routes/                   # API endpoints
    ├── main.py
    └── requirements.txt
```

---

## PRIORITY FIX ORDER

1. **FIRST (BLOCKING):** Issue #3 - Fix API endpoints in frontend
2. **SECOND (CRITICAL):** Issue #5 - Fix hardcoded JWT secret
3. **THIRD (HIGH):** Issue #1 - Remove console.log from booking route
4. **FOURTH (HIGH):** Issue #4 - Add error checking in frontend API calls
5. **FIFTH (MEDIUM):** Issue #2 - Fix hardcoded time in ChatWindow
6. **SIXTH (MEDIUM):** Issue #6 - Add atomic queue operations
7. **REMAINING:** Issues #7, #8, #9, #10, #11

---

## SUMMARY BY AREA

| Area | Status | Issues |
|------|--------|--------|
| **Backend Routes** | 🔴 Critical | #1, #3, #7 |
| **Frontend Services** | 🔴 Critical | #3, #4 |
| **Frontend Components** | 🟠 Major | #2 |
| **Security/Config** | 🔴 Critical | #5, #9 |
| **Data Consistency** | 🟠 Major | #6, #10 |
| **Error Handling** | 🟠 Major | #4, #8 |

---

## TESTING RECOMMENDATIONS

- [ ] Unit test for queue position logic (race conditions)
- [ ] Integration test for booking flow end-to-end
- [ ] Frontend API mocking/testing for endpoint discovery
- [ ] Load test with concurrent bookings
- [ ] Security audit of JWT implementation
- [ ] CORS policy validation

---

*End of Audit Report*
