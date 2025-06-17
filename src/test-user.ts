import * as fs from "fs";
import * as path from "path";

// ----------------------
// Types
// ----------------------
type EventType = "user-signed-up" | "user-active";

interface UserEvent {
  user_id: string;
  date: string;
  event: EventType;
  properties: {
    email: string;
    userName: string;
    isPaying: boolean;
    platform: string;
    region: string;
    user_role: string;
    plan_tier: string;
    beta_user: boolean;
  };
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
// Analytics Engine
// ----------------------
function analyze(data: UserEvent[]) {
  const signupsPerMonth: Record<string, number> = {};
  const dailyActiveUsers: Record<string, Set<string>> = {};
  const monthlyActiveUsers: Record<string, Set<string>> = {};
  const monthToDays: MonthDayMap = {};

  for (const event of data) {
    const { user_id, date, event: type } = event;
    const { day, month, year, monthIndex } = getDateParts(date + "T00:00:00Z");

    if (!monthToDays[month]) {
      monthToDays[month] = { year, monthIndex, days: new Set() };
    }
    monthToDays[month].days.add(day);

    if (type === "user-signed-up") {
      signupsPerMonth[month] = (signupsPerMonth[month] || 0) + 1;
    }

    // For both user-signed-up and user-active events, track daily and monthly active users
    if (!dailyActiveUsers[day]) dailyActiveUsers[day] = new Set();
    dailyActiveUsers[day].add(user_id);

    if (!monthlyActiveUsers[month]) monthlyActiveUsers[month] = new Set();
    monthlyActiveUsers[month].add(user_id);
  }

  const dau: Record<string, number> = {};
  for (const day in dailyActiveUsers) {
    dau[day] = dailyActiveUsers[day].size;
  }

  const mau: Record<string, number> = {};
  for (const month in monthlyActiveUsers) {
    mau[month] = monthlyActiveUsers[month].size;
  }

  const averageDauPerMonth: Record<string, number> = {};
  const averageSignupsPerMonth: Record<string, number> = {};

  for (const month in monthToDays) {
    const { year, monthIndex, days } = monthToDays[month];
    const numDays = days.size;
    const totalDau = Array.from(days).reduce(
      (sum, day) => sum + (dau[day] || 0),
      0
    );
    const daysInMonth = getDaysInMonth(year, monthIndex);

    averageDauPerMonth[month] = Math.floor(totalDau / numDays);
    averageSignupsPerMonth[month] = Math.floor(
      (signupsPerMonth[month] || 0) / daysInMonth
    );
  }

  return {
    signupsPerMonth,
    averageSignupsPerMonth,
    monthlyActiveUsers: mau,
    averageDauPerMonth,
  };
}

// ----------------------
// Pretty CLI Output
// ----------------------
function displayAnalytics(result: ReturnType<typeof analyze>) {
  const months = Object.keys(result.signupsPerMonth)
    .concat(Object.keys(result.monthlyActiveUsers))
    .concat(Object.keys(result.averageDauPerMonth))
    .concat(Object.keys(result.averageSignupsPerMonth));

  const uniqueMonths = Array.from(new Set(months)).sort();

  console.log("\n📊 User Analytics Per Month");
  console.log("───────────────────────────────────────────────");
  console.log("Month     Signups  AvgSignup  MAU    AvgDAU");
  console.log("───────────────────────────────────────────────");

  for (const month of uniqueMonths) {
    const signups = result.signupsPerMonth[month] ?? 0;
    const avgSignups = result.averageSignupsPerMonth[month] ?? 0;
    const mau = result.monthlyActiveUsers[month] ?? 0;
    const avgDau = result.averageDauPerMonth[month] ?? 0;

    console.log(
      `${month}   ${pad(signups)}    ${pad(avgSignups)}      ${pad(
        mau
      )}   ${pad(avgDau)}`
    );
  }

  console.log("───────────────────────────────────────────────\n");
}

function pad(n: number, width = 4) {
  return String(n).padStart(width, " ");
}

// ----------------------
// Runner
// ----------------------
function run() {
  const filePath = path.join(__dirname, "../user.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data: UserEvent[] = JSON.parse(raw);
  const result = analyze(data);
  displayAnalytics(result);
}

run();
