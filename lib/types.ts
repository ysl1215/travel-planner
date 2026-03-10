export interface TripPlannerInput {
  budget: number;
  currency: string;
  homeCity: string;
  startDate: string;
  endDate: string;
  flexDays: number;
  travelers: number;
  likedActivities: string[];
  dislikedActivities: string[];
  travelMode: string[];
  country?: string;
  maxTravelHours?: number;
  travelStyle: string;
}

export interface Destination {
  id: string;
  country: string;
  city: string;
  region?: string;
  rationale: string;
  highlights: string[];
  estimatedFlightHours: number;
  estimatedBudgetFit: "excellent" | "good" | "stretch";
  bestTimeToVisit: string;
  vibeMatch: string[];
  imageQuery: string;
}

export interface BudgetSplit {
  travel: number;
  accommodation: number;
  food: number;
  activities: number;
  misc: number;
}

export interface Attraction {
  name: string;
  type: "tourist" | "local" | "nature" | "food" | "culture";
  description: string;
  estimatedDuration: string;
  waitTime?: string;
  tips: string;
  offBeatenPath: boolean;
  cost: "free" | "cheap" | "moderate" | "expensive";
}

export interface FoodRecommendation {
  name: string;
  cuisine: string;
  description: string;
  priceRange: string;
  mustTry: string[];
  touristTrap: boolean;
  location: string;
}

export interface ItineraryDay {
  day: number;
  date?: string;
  location: string;
  theme: string;
  morning: ItineraryActivity[];
  afternoon: ItineraryActivity[];
  evening: ItineraryActivity[];
  travelNote?: string;
  accommodation?: string;
}

export interface ItineraryActivity {
  time: string;
  activity: string;
  location: string;
  duration: string;
  cost: string;
  tips?: string;
  waitTime?: string;
  type: "attraction" | "food" | "transport" | "accommodation" | "activity";
}

export interface RouteSegment {
  from: string;
  to: string;
  mode: string;
  duration: string;
  cost: string;
  tips?: string;
}

export interface TripItinerary {
  destination: string;
  totalDays: number;
  overview: string;
  days: ItineraryDay[];
  topAttractions: Attraction[];
  foodRecommendations: FoodRecommendation[];
  route: RouteSegment[];
  practicalTips: string[];
  bestTimeToVisit: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface PriceData {
  flights: FlightOffer[];
  hotels: HotelOffer[];
}

export interface FlightOffer {
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  price: number;
  currency: string;
  duration: string;
  stops: number;
}

export interface HotelOffer {
  name: string;
  rating: number;
  location: string;
  pricePerNight: number;
  currency: string;
  amenities: string[];
}
