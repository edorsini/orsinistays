import { readFile, writeFile } from "node:fs/promises";

const outputPath = process.env.AVAILABILITY_OUTPUT || "availability.json";
const snapshotOutputPath =
  process.env.AVAILABILITY_SNAPSHOT_OUTPUT || "availability.js";
const calendars = [
  {
    key: "dreamcatcher",
    source: process.env.AIRBNB_DREAMCATCHER_ICAL_URL,
  },
  {
    key: "happy-place",
    source: process.env.AIRBNB_HAPPY_PLACE_ICAL_URL,
  },
];

function requireSources() {
  const missing = calendars
    .filter((calendar) => !calendar.source)
    .map((calendar) => calendar.key);

  if (missing.length) {
    throw new Error(
      `Missing calendar source for: ${missing.join(", ")}. Configure the repository Actions secrets first.`,
    );
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadCalendar(source) {
  if (source.startsWith("file:")) {
    return readFile(new URL(source), "utf8");
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(source, {
        headers: {
          accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
          "user-agent": "OrsiniStays availability sync",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`Airbnb returned HTTP ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1_000);
    }
  }

  throw lastError;
}

function toIsoDate(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function eventDate(event, field) {
  const match = event.match(new RegExp(`^${field}(?:;[^:]*)?:(\\d{8})`, "m"));
  return match ? toIsoDate(match[1]) : null;
}

function mergeRanges(ranges) {
  const sorted = ranges.sort((left, right) =>
    left.start.localeCompare(right.start),
  );

  return sorted.reduce((merged, range) => {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = range.end > previous.end ? range.end : previous.end;
    } else {
      merged.push({ ...range });
    }
    return merged;
  }, []);
}

function unavailableRanges(ical) {
  const unfolded = ical.replace(/\r?\n[ \t]/g, "");
  if (!unfolded.includes("BEGIN:VCALENDAR")) {
    throw new Error("Airbnb returned an invalid calendar");
  }

  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  const ranges = events.map((event) => {
    const start = eventDate(event, "DTSTART");
    const end = eventDate(event, "DTEND");
    if (!start || !end || start >= end) {
      throw new Error("Airbnb returned an event with invalid dates");
    }
    return { start, end };
  });

  return mergeRanges(ranges);
}

async function main() {
  requireSources();

  const results = await Promise.all(
    calendars.map(async (calendar) => ({
      key: calendar.key,
      unavailable: unavailableRanges(await loadCalendar(calendar.source)),
    })),
  );

  const properties = Object.fromEntries(
    results.map((result) => [
      result.key,
      { unavailable: result.unavailable },
    ]),
  );
  const output = { version: 1, properties };

  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(
      snapshotOutputPath,
      `window.ORSINI_AVAILABILITY = ${JSON.stringify(output, null, 2)};\n`,
      "utf8",
    ),
  ]);
  console.log(
    `Updated ${outputPath} and ${snapshotOutputPath} with Airbnb availability.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
