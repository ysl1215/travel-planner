export type GoogleFlightsErrorKind = "no_flights" | "scrape_failure";

type GoogleFlightsErrorSummary = {
  message: string;
  kind: GoogleFlightsErrorKind;
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeHtmlDump(value: string) {
  return /<\s*!doctype|<\s*html|<\/?[a-z][\s\S]*>|skip to main content|accessibility feedback|loading results|flight search/i.test(
    value
  );
}

export function summarizeGoogleFlightsError(rawError: string | null | undefined): GoogleFlightsErrorSummary {
  const cleaned = compactWhitespace(rawError ?? "");
  if (!cleaned) {
    return {
      message: "Google Flights could not return results right now.",
      kind: "scrape_failure",
    };
  }

  const noFlights = /no flights found/i.test(cleaned);
  const htmlish = looksLikeHtmlDump(cleaned) || cleaned.length > 400;

  if (noFlights && !htmlish) {
    return {
      message: "No flights found for these dates.",
      kind: "no_flights",
    };
  }

  if (noFlights || htmlish) {
    return {
      message: "Google Flights temporarily returned an unusable response. Try again later or change the dates.",
      kind: noFlights ? "no_flights" : "scrape_failure",
    };
  }

  return {
    message: cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned,
    kind: "scrape_failure",
  };
}
