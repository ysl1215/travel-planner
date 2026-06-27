# Implementation Plan — 4 borrows from the repo investigation

> Created 2026-06-21. Source: investigation of 12 travel repos (see `git-repo-investigation.md`
> and the durable eval in the memory note `reference_travel_planner_repo_evals`). This plan covers
> all four actionable items, ordered by leverage. Each is independent — implement in any order.
> Verification for every code item: `npx tsc --noEmit` + `npx vitest run` (use `/usr/bin/python3` for any sqlite).

## Context
The investigation surfaced four borrows. Three improve travel-planner's differentiator ("Half A":
AI suggestion + pricing + itinerary generation); one is a reliability fix for an existing dependency.
Single biggest scoping fact: **travel-planner is single-destination today** — `TripPlannerInput`
(`lib/types.ts:1`) has `homeCity` + optional `country`, the flow is home→suggest→pick ONE→itinerary,
and `RouteSegment`/`TripItinerary.route` are LLM free-text (never computed). This makes the validator
and Duffel drop-in, but route-ordering a net-new feature.

Leverage order: **1) Constraint validator → 2) Duffel provider → 3) fast-flights hardening → 4) Route-ordering.**

---

## Item 1 — Deterministic itinerary constraint validator (TravelPlanner #12) ★ highest leverage

**Why.** The ICML'24 benchmark showed even GPT-4 scores 0.6% "final pass" because models satisfy
individual constraints but fail their *conjunction*. travel-planner already does fragments
(`correctAndFilterByTravelTime`, `preferenceMatch`) but never checks the generated itinerary as a whole.

**Done =** a pure function that scores a `TripItinerary` against hard + commonsense constraints, runs
after schema validation in the itinerary route, and triggers one targeted re-prompt when it fails.

**New file: `lib/itineraryConstraints.ts`** — pure, no I/O, unit-testable. Export:
```ts
interface ConstraintViolation { rule: string; severity: "hard" | "commonsense"; detail: string }
interface ConstraintReport { passed: boolean; finalPass: boolean; violations: ConstraintViolation[] }
function validateItineraryConstraints(
  itinerary: TripItinerary, input: TripPlannerInput, budgetSplit: BudgetSplit,
  knownAttractions?: Attraction[]   // from the DB index, when available — the "within sandbox" check
): ConstraintReport
```
Checks (deterministic, NOT the LLM):
- **Hard** — total estimated cost ≤ `input.budget` (compute programmatically from activity `cost` +
  budgetSplit; don't trust model arithmetic — the "budget drift" failure mode); `totalDays` matches
  startDate→endDate span; transport modes ⊆ `input.travelMode`.
- **Commonsense** — no duplicate attractions/restaurants across days (dedupe by normalized name; reuse
  the `normalizeName` idea from `scripts/scrape_attractions.py`); every `ItineraryActivity.location`
  for a day is consistent with that `ItineraryDay.location` (right-city rule); no day with empty
  morning+afternoon+evening; if `knownAttractions` provided, every attraction in the plan exists in it
  (the "within sandbox" / no-hallucinated-venue rule — soft when index is empty).

**Wire into `app/api/itinerary/route.ts`** (after each successful `validateItinerary(...)` at lines
112/122/157/176): run `validateItineraryConstraints(...)`; if `!finalPass`, do **one** targeted
re-prompt appending the violations as constraints (mirror the existing `requestJsonCorrection` retry
shape), then re-validate. Always return the report in the response (`{ itinerary, constraintReport, ... }`)
so the UI can surface warnings rather than hard-fail (don't block delivery on commonsense misses).

**Tests: `lib/__tests__/itineraryConstraints.test.ts`** — over-budget, mismatched day count,
duplicate venue, wrong-city activity, disallowed transport, hallucinated venue (with/without index),
and an all-pass case.

**Effort:** Low–Med. **Risk:** Low — additive, pure function, no provider/network.

---

## Item 2 — Duffel flight price provider (travel-hacking-toolkit #11)

**Why.** Kiwi signup is discontinued (blocked) and fast-flights is a fragile scraper with an
absentee maintainer (Item 3). Duffel is an official flight API with a free dev tier — a durable
primary that fits the existing provider-fallback chain.

**Done =** a `lib/duffel.ts` that mirrors the Kiwi contract and is inserted as the first provider in
the `prices/route.ts` fallback chain, gated on an env key so it's a no-op when unconfigured.

**New file: `lib/duffel.ts`** — copy the *shape* of `lib/kiwi.ts` exactly (license-safe; we're
writing fresh against Duffel's API):
```ts
export function isConfigured(): boolean   // !!process.env.DUFFEL_API_TOKEN
export async function searchFlights(params: KiwiSearchParams):
  Promise<{ flights: FlightOffer[]; error: string | null }>
```
Duffel uses a two-step model: `POST /air/offer_requests` (slices = origin/destination/departure,
passengers, cabin_class) → returns offers; map each offer to the existing `FlightOffer` type
(`lib/types.ts:136`). Auth: `Authorization: Bearer ${DUFFEL_API_TOKEN}`, header `Duffel-Version`.
Keep the same retry/timeout discipline as kiwi.ts.

**Wire into `app/api/prices/route.ts` `fetchWithFallback` (line 128):** new order →
**Duffel (if configured) → Kiwi (if configured) → fast-flights**. Each step already falls through on
empty/error; just prepend the Duffel block mirroring the existing Kiwi block (lines 130–155).

**Config:** add `DUFFEL_API_TOKEN` to `.env.local.example` + the README env table.

**Tests: `lib/__tests__/duffel.test.ts`** — offer→FlightOffer mapping, not-configured returns
`{flights:[], error}`, error handling. Mock fetch (no live calls in CI).

**Effort:** Med. **Risk:** Low — purely additive provider; existing chain untouched when key absent.

---

## Item 3 — fast-flights hardening (AWeirdDev/flights #7)

**Why.** travel-planner depends on it as the flight fallback (`scripts/google_flights.py`). v3.0
(Jun 2026) is a **breaking API change** (`create_query`/`FlightQuery` vs the old flat
`get_flights(flight_data=[FlightData(...)])`), and the maintainer publicly stepped back (issue #92),
with open empty-result/401 bugs.

**Done =** we know exactly which API version `google_flights.py` targets, the dependency is pinned so
a `pip install -U` can't silently break it, and the failure mode is graceful.

**Steps (diagnose first — do NOT upgrade blindly):**
1. Read `scripts/google_flights.py` and identify which API it calls (old `get_flights(flight_data=...)`
   vs new `create_query`). Check the installed version: `/usr/bin/python3 -m pip show fast-flights`.
2. **Pin** the working version wherever deps are declared (README `pip install fast-flights==X.Y`,
   and any requirements file). Document the pin + the v3.0 breaking-change note inline.
3. Confirm `app/api/prices/route.ts` already degrades gracefully when the script returns no output
   (it does — `runFlightScript` rejects and `fetchWithFallback` returns `{flights:[], error}`); add a
   comment noting fast-flights is now *best-effort* given maintainer status.
4. If on the broken v2.2 hosted-Playwright path (#109): note that Item 2 (Duffel) is the durable fix;
   do not invest in repairing the scraper.

**Effort:** Low (mostly diagnosis + pin). **Risk:** Low. **Depends on:** nothing, but pairs with Item 2.

---

## Item 4 — Multi-city route ordering (TREK deep-dive) — net-new feature

**Why.** Answers the "I already know my cities; some transport is infrequent — order them optimally"
use case. TREK (5.7k★) validated that hand-rolled **nearest-neighbor + 2-opt** is the right tool; at
trip scale (n≤~10) exact **Held-Karp** is optimal in ms. The algorithm is the easy part — it's generic
public-domain CS (no AGPL concern). **The real work is (a) a new multi-city input/flow and (b) the
asymmetric cost matrix.**

**Done =** given a set of known cities + a home origin, the app returns an optimal visiting order using
real travel cost, routing around unavailable/infrequent legs.

**Phase A — optimizer (isolated, no UI). `lib/routeOrder.ts`:**
```ts
type CostMatrix = number[][]   // asymmetric; Infinity = unavailable leg
function orderRoute(cities: string[], cost: CostMatrix, opts?: { fixedStart?: number; fixedEnd?: number }):
  { order: number[]; totalCost: number }
// n <= 10 → Held-Karp (exact); else nearest-neighbor seed + 2-opt (Or-opt for asymmetric)
```
Pure, fully unit-testable in isolation. **Tests:** known-optimal small cases, an ∞-leg forces a detour,
symmetric vs asymmetric, fixedStart anchoring (home city).

**Phase B — cost matrix builder. `lib/costMatrix.ts`:**
Build the `CostMatrix` from existing sources — `estimateFlightHours` (`lib/flightTime.ts`) as the
always-available seed; optionally enrich with `lib/hafas.ts` (train times) and `lib/kiwi.ts`/Duffel
(flight price/time) per leg. Encode an unavailable/infrequent leg as `Infinity` (v1 penalty approach).
Time-windowed schedules ("ferry only Tuesdays") are **out of scope** — that's TSP-TW, a separate effort.

**Phase C — input flow + UI (the largest part).**
- Extend `TripPlannerInput` (`lib/types.ts:1`) with optional `knownCities?: string[]` (keeps the
  existing suggest flow intact — this is an alternate "I already know where" mode).
- New route `app/api/route-order/route.ts`: input cities → build matrix → `orderRoute` → return order
  + per-leg `RouteSegment[]` (the existing type, `lib/types.ts:88`).
- UI: a multi-city entry mode + an ordered-route display. (Scope this as its own sub-task.)

**Effort:** Med–High (A is small; C is a feature). **Risk:** Med — net-new product surface.
**Recommendation:** build Phase A + B first (high-value, isolated, testable); gate Phase C on whether
multi-city is a desired product direction.

---

## Suggested sequence
1. **Item 1** (validator) — highest leverage, lowest risk, improves every itinerary today.
2. **Item 3** (fast-flights diagnose+pin) — cheap, removes a live risk; informs Item 2 urgency.
3. **Item 2** (Duffel) — durable pricing; the real fix for the blocked-Kiwi/fragile-scraper situation.
4. **Item 4** (route ordering) — Phases A+B when ready; Phase C only if multi-city is wanted.
