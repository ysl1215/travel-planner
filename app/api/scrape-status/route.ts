import { NextResponse } from "next/server";
import { getScrapeQueue, getDb } from "@/lib/db";

export async function GET() {
  const queue = getScrapeQueue();
  const db = getDb();

  // Count indexed attractions per city
  const counts: Record<string, number> = {};
  if (db) {
    const rows: { city: string; count: number }[] = db
      .prepare("SELECT city, COUNT(*) as count FROM attractions GROUP BY city")
      .all();
    for (const r of rows) counts[r.city.toLowerCase()] = r.count;
  }

  const cities = queue.map((row) => ({
    city:          row.city,
    country:       row.country,
    status:        row.status,
    queued_at:     row.queued_at,
    started_at:    row.started_at,
    finished_at:   row.finished_at,
    error:         row.error,
    attractions:   counts[row.city.toLowerCase()] ?? 0,
  }));

  const summary = {
    total:   queue.length,
    pending: queue.filter((r) => r.status === "pending").length,
    running: queue.filter((r) => r.status === "running").length,
    done:    queue.filter((r) => r.status === "done").length,
    failed:  queue.filter((r) => r.status === "failed").length,
  };

  return NextResponse.json({ summary, cities });
}
