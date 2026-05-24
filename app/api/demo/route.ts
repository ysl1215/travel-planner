import { NextRequest, NextResponse } from "next/server";
import { DEMO_DESTINATIONS, DEMO_ITINERARY, DEMO_INPUT } from "@/lib/mockData";

/**
 * GET /api/demo?resource=destinations|itinerary|input
 *
 * Returns pre-seeded mock data for all three app screens so the
 * full UI flow (form → destinations → itinerary) can be explored
 * without configuring any API keys.
 */
export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") ?? "destinations";

  switch (resource) {
    case "destinations":
      return NextResponse.json({ destinations: DEMO_DESTINATIONS });

    case "itinerary":
      return NextResponse.json({ itinerary: DEMO_ITINERARY });

    case "input":
      return NextResponse.json({ input: DEMO_INPUT });

    default:
      return NextResponse.json(
        { error: `Unknown resource "${resource}". Use destinations | itinerary | input.` },
        { status: 400 }
      );
  }
}
