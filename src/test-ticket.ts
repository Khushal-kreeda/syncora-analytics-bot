import * as fs from "fs";
import * as path from "path";

// ----------------------
// Types
// ----------------------
type TicketEventType = "ticket-raised" | "ticket-resolved";

interface TicketEvent {
  event: TicketEventType;
  email: string;
  username: string;
  timestamp: string;
}

interface DateParts {
  day: string;
  month: string;
  year: number;
  monthIndex: number;
}

interface MonthDayMap {
  [month: string]: {
    year: number;
    monthIndex: number;
    days: Set<string>;
  };
}

// ----------------------
// Helpers
// ----------------------
function getDateParts(timestamp: string): DateParts {
  const date = new Date(timestamp);
  return {
    day: date.toISOString().slice(0, 10),
    month: date.toISOString().slice(0, 7),
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
  };
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getUTCDate();
}

// ----------------------
// Ticket Analytics Engine
// ----------------------
function analyzeTickets(data: TicketEvent[]) {
  const ticketsRaisedPerMonth: Record<string, number> = {};
  const ticketsResolvedPerMonth: Record<string, number> = {};
  const dailyTicketsRaised: Record<string, number> = {};
  const dailyTicketsResolved: Record<string, number> = {};
  const monthToDays: MonthDayMap = {};
  const uniqueUsersPerMonth: Record<string, Set<string>> = {};
  const activeUsersPerDay: Record<string, Set<string>> = {};

  for (const event of data) {
    const { email, username, timestamp, event: type } = event;
    const { day, month, year, monthIndex } = getDateParts(timestamp);

    // Track month and days
    if (!monthToDays[month]) {
      monthToDays[month] = { year, monthIndex, days: new Set() };
    }
    monthToDays[month].days.add(day);

    // Track unique users per month and day
    if (!uniqueUsersPerMonth[month]) uniqueUsersPerMonth[month] = new Set();
    uniqueUsersPerMonth[month].add(email);

    if (!activeUsersPerDay[day]) activeUsersPerDay[day] = new Set();
    activeUsersPerDay[day].add(email);

    // Track ticket events
    if (type === "ticket-raised") {
      ticketsRaisedPerMonth[month] = (ticketsRaisedPerMonth[month] || 0) + 1;
      dailyTicketsRaised[day] = (dailyTicketsRaised[day] || 0) + 1;
    } else if (type === "ticket-resolved") {
      ticketsResolvedPerMonth[month] =
        (ticketsResolvedPerMonth[month] || 0) + 1;
      dailyTicketsResolved[day] = (dailyTicketsResolved[day] || 0) + 1;
    }
  }

  // Calculate averages
  const averageTicketsRaisedPerMonth: Record<string, number> = {};
  const averageTicketsResolvedPerMonth: Record<string, number> = {};
  const averageActiveUsersPerMonth: Record<string, number> = {};

  for (const month in monthToDays) {
    const { year, monthIndex, days } = monthToDays[month];
    const numDays = days.size;
    const daysInMonth = getDaysInMonth(year, monthIndex);

    // Average tickets per day in month
    const totalRaised = Array.from(days).reduce(
      (sum, day) => sum + (dailyTicketsRaised[day] || 0),
      0
    );
    const totalResolved = Array.from(days).reduce(
      (sum, day) => sum + (dailyTicketsResolved[day] || 0),
      0
    );
    const totalActiveUsers = Array.from(days).reduce(
      (sum, day) => sum + (activeUsersPerDay[day]?.size || 0),
      0
    );

    averageTicketsRaisedPerMonth[month] =
      Math.round((totalRaised / numDays) * 100) / 100;
    averageTicketsResolvedPerMonth[month] =
      Math.round((totalResolved / numDays) * 100) / 100;
    averageActiveUsersPerMonth[month] =
      Math.round((totalActiveUsers / numDays) * 100) / 100;
  }

  // Calculate resolution rate
  const resolutionRatePerMonth: Record<string, number> = {};
  for (const month in ticketsRaisedPerMonth) {
    const raised = ticketsRaisedPerMonth[month] || 0;
    const resolved = ticketsResolvedPerMonth[month] || 0;
    resolutionRatePerMonth[month] =
      raised > 0 ? Math.round((resolved / raised) * 100) : 0;
  }

  return {
    ticketsRaisedPerMonth,
    ticketsResolvedPerMonth,
    averageTicketsRaisedPerMonth,
    averageTicketsResolvedPerMonth,
    uniqueUsersPerMonth: Object.fromEntries(
      Object.entries(uniqueUsersPerMonth).map(([month, users]) => [
        month,
        users.size,
      ])
    ),
    averageActiveUsersPerMonth,
    resolutionRatePerMonth,
  };
}

// ----------------------
// Pretty CLI Output
// ----------------------
function displayTicketAnalytics(result: ReturnType<typeof analyzeTickets>) {
  const months = Object.keys(result.ticketsRaisedPerMonth)
    .concat(Object.keys(result.ticketsResolvedPerMonth))
    .concat(Object.keys(result.uniqueUsersPerMonth));

  const uniqueMonths = Array.from(new Set(months)).sort();

  console.log("\n🎫 Ticket Analytics Per Month");
  console.log(
    "─────────────────────────────────────────────────────────────────────"
  );
  console.log(
    "Month     Raised  Resolved  AvgRaised  AvgResolved  Users  ResRate%"
  );
  console.log(
    "─────────────────────────────────────────────────────────────────────"
  );

  for (const month of uniqueMonths) {
    const raised = result.ticketsRaisedPerMonth[month] ?? 0;
    const resolved = result.ticketsResolvedPerMonth[month] ?? 0;
    const avgRaised = result.averageTicketsRaisedPerMonth[month] ?? 0;
    const avgResolved = result.averageTicketsResolvedPerMonth[month] ?? 0;
    const users = result.uniqueUsersPerMonth[month] ?? 0;
    const resRate = result.resolutionRatePerMonth[month] ?? 0;

    console.log(
      `${month}   ${pad(raised, 6)}  ${pad(resolved, 8)}  ${pad(
        avgRaised,
        9
      )}  ${pad(avgResolved, 11)}  ${pad(users, 5)}  ${pad(resRate, 7)}%`
    );
  }

  console.log(
    "─────────────────────────────────────────────────────────────────────"
  );

  // Summary stats
  const totalRaised = Object.values(result.ticketsRaisedPerMonth).reduce(
    (a, b) => a + b,
    0
  );
  const totalResolved = Object.values(result.ticketsResolvedPerMonth).reduce(
    (a, b) => a + b,
    0
  );
  const overallResolutionRate =
    totalRaised > 0 ? Math.round((totalResolved / totalRaised) * 100) : 0;
  const totalUniqueUsers = new Set(
    Object.values(result.uniqueUsersPerMonth).reduce(
      (acc: string[], count, index) => {
        // This is a simplified calculation - in reality we'd need to track unique emails across all months
        return acc;
      },
      []
    )
  ).size;

  console.log(`\n📈 Summary:`);
  console.log(`   Total Tickets Raised: ${totalRaised}`);
  console.log(`   Total Tickets Resolved: ${totalResolved}`);
  console.log(`   Overall Resolution Rate: ${overallResolutionRate}%`);
  console.log(
    `   Peak Month (Raised): ${getPeakMonth(result.ticketsRaisedPerMonth)}`
  );
  console.log(
    `   Peak Month (Resolved): ${getPeakMonth(result.ticketsResolvedPerMonth)}`
  );
  console.log("\n");
}

function pad(n: number, width = 4): string {
  const str = typeof n === "number" && n % 1 !== 0 ? n.toFixed(2) : String(n);
  return str.padStart(width, " ");
}

function getPeakMonth(monthData: Record<string, number>): string {
  let maxValue = 0;
  let maxMonth = "";

  for (const [month, value] of Object.entries(monthData)) {
    if (value > maxValue) {
      maxValue = value;
      maxMonth = month;
    }
  }

  return maxMonth ? `${maxMonth} (${maxValue})` : "N/A";
}

// ----------------------
// Runner
// ----------------------
function run() {
  try {
    const filePath = path.join(__dirname, "../events.json");

    if (!fs.existsSync(filePath)) {
      console.error(
        "❌ events.json file not found. Please run the ticket generation script first."
      );
      return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const data: TicketEvent[] = JSON.parse(raw);

    if (data.length === 0) {
      console.log("📭 No ticket events found in events.json");
      return;
    }

    console.log(`🔍 Analyzing ${data.length} ticket events...`);
    const result = analyzeTickets(data);
    displayTicketAnalytics(result);
  } catch (error) {
    console.error("❌ Error analyzing ticket data:", error);
  }
}

run();
