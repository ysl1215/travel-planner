/**
 * Best-guess IATA airport code for a city name.
 * Used to derive the origin airport from the user's home city input
 * and to find a destination airport for each suggestion card.
 *
 * Extend this list as needed — city names are matched case-insensitively.
 */
export const CITY_TO_AIRPORT: Record<string, string> = {
  london: "LHR",
  "new york": "JFK",
  "los angeles": "LAX",
  chicago: "ORD",
  paris: "CDG",
  amsterdam: "AMS",
  frankfurt: "FRA",
  madrid: "MAD",
  barcelona: "BCN",
  rome: "FCO",
  milan: "MXP",
  lisbon: "LIS",
  porto: "OPO",
  athens: "ATH",
  istanbul: "IST",
  dubai: "DXB",
  singapore: "SIN",
  tokyo: "NRT",
  osaka: "KIX",
  fukuoka: "FUK",
  nagoya: "NGO",
  sapporo: "CTS",
  bangkok: "BKK",
  sydney: "SYD",
  melbourne: "MEL",
  toronto: "YYZ",
  montreal: "YUL",
  "san francisco": "SFO",
  seattle: "SEA",
  vancouver: "YVR",
  miami: "MIA",
  boston: "BOS",
  "mexico city": "MEX",
  "sao paulo": "GRU",
  "buenos aires": "EZE",
  cairo: "CAI",
  johannesburg: "JNB",
  nairobi: "NBO",
  delhi: "DEL",
  mumbai: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  chennai: "MAA",
  kolkata: "CCU",
  "calcutta": "CCU",
  kathmandu: "KTM",
  colombo: "CMB",
  dhaka: "DAC",
  beijing: "PEK",
  shanghai: "PVG",
  hangzhou: "HGH",
  nanjing: "NKG",
  guangzhou: "CAN",
  shenzhen: "SZX",
  xiamen: "XMN",
  chengdu: "CTU",
  chongqing: "CKG",
  "xi'an": "XIY",
  xian: "XIY",
  wuhan: "WUH",
  fuzhou: "FOC",
  quingdao: "TAO",
  qingdao: "TAO",
  dalian: "DLC",
  kunming: "KMG",
  sanya: "SYX",
  harbin: "HRB",
  seoul: "ICN",
  busan: "PUS",
  taipei: "TPE",
  "hong kong": "HKG",
  macau: "MFM",
  "kuala lumpur": "KUL",
  jakarta: "CGK",
  manila: "MNL",
  "ho chi minh city": "SGN",
  "ho chi minh": "SGN",
  hanoi: "HAN",
  "da nang": "DAD",
  phuket: "HKT",
  "chiang mai": "CNX",
  vienna: "VIE",
  zurich: "ZRH",
  brussels: "BRU",
  copenhagen: "CPH",
  stockholm: "ARN",
  oslo: "OSL",
  helsinki: "HEL",
  warsaw: "WAW",
  prague: "PRG",
  budapest: "BUD",
  krakow: "KRK",
  kraków: "KRK",
  bucharest: "OTP",
  sofia: "SOF",
  zagreb: "ZAG",
  belgrade: "BEG",
  sarajevo: "SJJ",
  podgorica: "TGD",
  tirana: "TIA",
  skopje: "SKP",
  thessaloniki: "SKG",
  heraklion: "HER",
};

/**
 * Returns the best-guess IATA airport code for a city name.
 * Falls back to matching on the first word of a compound name
 * (e.g. "London, UK" → "LHR").
 */
export function cityToAirport(cityName: string): string | undefined {
  const lower = cityName.toLowerCase().trim();
  if (CITY_TO_AIRPORT[lower]) return CITY_TO_AIRPORT[lower];
  const firstWord = lower.split(/[,\s]/)[0];
  return CITY_TO_AIRPORT[firstWord];
}

export function resolveAirportCode(cityName: string, override?: string | null): string | undefined {
  const trimmedOverride = override?.trim().toUpperCase();
  if (trimmedOverride && /^[A-Z0-9]{3}$/.test(trimmedOverride)) return trimmedOverride;
  return cityToAirport(cityName);
}
