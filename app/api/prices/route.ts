import { NextRequest, NextResponse } from "next/server";
import { FlightOffer, HotelOffer } from "@/lib/types";

// Amadeus API free test environment
const AMADEUS_API_BASE = "https://test.api.amadeus.com/v2";
const AMADEUS_AUTH_BASE = "https://test.api.amadeus.com/v1";

let amadeusToken: string | null = null;
let tokenExpiry: number = 0;

async function getAmadeusToken(): Promise<string> {
  if (amadeusToken && Date.now() < tokenExpiry) {
    return amadeusToken;
  }

  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Amadeus API credentials not configured");
  }

  const response = await fetch(`${AMADEUS_AUTH_BASE}/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to authenticate with Amadeus API");
  }

  const data = await response.json();
  amadeusToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return amadeusToken!;
}

async function searchFlights(
  originCode: string,
  destinationCode: string,
  departureDate: string,
  returnDate: string,
  adults: number
): Promise<FlightOffer[]> {
  const token = await getAmadeusToken();

  const params = new URLSearchParams({
    originLocationCode: originCode,
    destinationLocationCode: destinationCode,
    departureDate,
    returnDate,
    adults: String(adults),
    max: "5",
    currencyCode: "USD",
  });

  const response = await fetch(
    `${AMADEUS_API_BASE}/shopping/flight-offers?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    console.error("Flight search failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.data ?? []).map((offer: Record<string, unknown>) => {
    const itinerary = (offer.itineraries as Record<string, unknown>[])?.[0];
    const segments = (itinerary?.segments as Record<string, unknown>[]) ?? [];
    const firstSeg = segments[0] ?? {};
    const lastSeg = segments[segments.length - 1] ?? {};
    const departure = firstSeg.departure as Record<string, string> | undefined;
    const arrival = lastSeg.arrival as Record<string, string> | undefined;

    return {
      airline: String((offer.validatingAirlineCodes as string[])?.[0] ?? ""),
      origin: String(departure?.iataCode ?? originCode),
      destination: String(arrival?.iataCode ?? destinationCode),
      departureDate: String(departure?.at ?? departureDate).split("T")[0],
      returnDate,
      price: parseFloat(String((offer.price as Record<string, string>)?.total ?? "0")),
      currency: "USD",
      duration: String(itinerary?.duration ?? ""),
      stops: segments.length - 1,
    } as FlightOffer;
  });
}

async function searchHotels(
  cityCode: string,
  checkIn: string,
  checkOut: string,
  adults: number
): Promise<HotelOffer[]> {
  const token = await getAmadeusToken();

  // First get hotel list
  const hotelParams = new URLSearchParams({
    cityCode,
    radius: "5",
    radiusUnit: "KM",
    hotelSource: "ALL",
  });

  const hotelListRes = await fetch(
    `${AMADEUS_AUTH_BASE}/reference-data/locations/hotels/by-city?${hotelParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!hotelListRes.ok) {
    console.error("Hotel list failed:", await hotelListRes.text());
    return [];
  }

  const hotelList = await hotelListRes.json();
  const hotelIds = ((hotelList.data ?? []) as Record<string, unknown>[])
    .slice(0, 10)
    .map((h) => String(h.hotelId))
    .join(",");

  if (!hotelIds) return [];

  // Search hotel offers
  const offerParams = new URLSearchParams({
    hotelIds,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults: String(adults),
    currency: "USD",
    bestRateOnly: "true",
  });

  const offersRes = await fetch(
    `${AMADEUS_API_BASE}/shopping/hotel-offers?${offerParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!offersRes.ok) {
    console.error("Hotel offers failed:", await offersRes.text());
    return [];
  }

  const offersData = await offersRes.json();
  return ((offersData.data ?? []) as Record<string, unknown>[]).map((item) => {
    const hotel = item.hotel as Record<string, unknown>;
    const offers = item.offers as Record<string, unknown>[];
    const firstOffer = offers?.[0] ?? {};
    const price = firstOffer.price as Record<string, string> | undefined;

    return {
      name: String(hotel?.name ?? "Unknown Hotel"),
      rating: Number(hotel?.rating ?? 0),
      location: String(hotel?.cityCode ?? cityCode),
      pricePerNight: parseFloat(String(price?.total ?? "0")),
      currency: "USD",
      amenities: [],
    } as HotelOffer;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const originCode = searchParams.get("origin") ?? "";
    const destinationCode = searchParams.get("destination") ?? "";
    const departureDate = searchParams.get("departure") ?? "";
    const returnDate = searchParams.get("return") ?? "";
    const adults = parseInt(searchParams.get("adults") ?? "1", 10);

    if (!originCode || !destinationCode || !departureDate) {
      return NextResponse.json(
        { error: "Missing required params: origin, destination, departure" },
        { status: 400 }
      );
    }

    const [flights, hotels] = await Promise.allSettled([
      searchFlights(originCode, destinationCode, departureDate, returnDate, adults),
      searchHotels(destinationCode, departureDate, returnDate, adults),
    ]);

    return NextResponse.json({
      flights: flights.status === "fulfilled" ? flights.value : [],
      hotels: hotels.status === "fulfilled" ? hotels.value : [],
      flightError: flights.status === "rejected" ? String(flights.reason) : null,
      hotelError: hotels.status === "rejected" ? String(hotels.reason) : null,
    });
  } catch (error) {
    console.error("Error fetching prices:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch prices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
