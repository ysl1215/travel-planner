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
  preferHiddenGems?: boolean;
  travelPriorities: string;
  pastTrips?: string;
}

export interface Destination {
  id: string;
  country: string;
  city: string;
  region?: string;
  airportCode?: string;
  rationale: string;
  highlights: string[];
  estimatedFlightHours: number;
  estimatedBudgetFit: "excellent" | "good" | "stretch";
  bestTimeToVisit: string;
  vibeMatch: string[];
  imageQuery: string;
  preferenceWarning?: string;
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

export interface ClusterOption {
  label: string;          // e.g. "Half day", "Full day"
  attractions: string[];  // attraction names included in this option
  hours: number;          // total time in hours
  tradeoff: string;       // what you miss or gain
}

export interface ItineraryCluster {
  cluster: string;           // area/group name, e.g. "Plitvice Lakes area"
  attractions: string[];     // all attraction names in this cluster
  options: ClusterOption[];  // 2-3 time-budget options
  recommendation: string;    // label of the recommended option
  recommendation_reason: string;
}

export interface TripItinerary {
  destination: string;
  totalDays: number;
  overview: string;
  days: ItineraryDay[];
  clusters?: ItineraryCluster[];   // optional — only present when multi-attraction areas exist
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
  departureTime?: string;
  arrivalTime?: string;
  price: number;
  currency: string;
  duration: string;
  stops: number;
  isBest?: boolean;
}

export interface HotelOffer {
  name: string;
  rating: number;
  location: string;
  pricePerNight: number;
  currency: string;
  amenities: string[];
}
