import * as fs from "fs";
import * as path from "path";

// ----------------------
// Types (Updated for new data structure)
// ----------------------
interface UserSignUpEvent {
  email: string;
  userId: string;
  username: string;
  timestamp: string;
  event: "user-signed-up";
  acquisition_source: string;
  country: string;
  isPaying: boolean;
  subscriptionType: string;
}

interface UserLoginEvent {
  email: string;
  userId: string;
  username: string;
  timestamp: string;
  event: "user-logged-in";
  acquisition_source: string;
  country: string;
  isPaying: boolean;
  subscriptionType: string;
}

type UserEvent = UserSignUpEvent | UserLoginEvent;

interface DateParts {
  day: string;
  month: string;
  year: number;
  monthIndex: number;
}

interface MonthlyStats {
  signups: number;
  logins: number;
  pageviews: number; // Total pageviews (signups + logins)
  activeUsers: Set<string>;
  countries: Record<string, number>;
  acquisitionSources: Record<string, number>;
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

function getMonthName(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return monthNames[parseInt(month) - 1];
}

// ----------------------
// Analytics Engine
// ----------------------
function analyze(data: UserEvent[]) {
  const monthStats: Record<string, MonthlyStats> = {};
  const dailyActiveUsers: Record<string, Set<string>> = {};

  // Process all events
  for (const event of data) {
    const {
      userId,
      timestamp,
      event: eventType,
      country,
      acquisition_source,
    } = event;
    const { day, month } = getDateParts(timestamp);

    // Initialize month stats if needed
    if (!monthStats[month]) {
      monthStats[month] = {
        signups: 0,
        logins: 0,
        pageviews: 0,
        activeUsers: new Set(),
        countries: {},
        acquisitionSources: {},
      };
    }

    // Track daily active users
    if (!dailyActiveUsers[day]) {
      dailyActiveUsers[day] = new Set();
    }
    dailyActiveUsers[day].add(userId);

    // Update month stats
    const stats = monthStats[month];
    stats.activeUsers.add(userId);
    stats.pageviews++; // Every event (signup/login) counts as a pageview

    if (eventType === "user-signed-up") {
      stats.signups++;
      stats.countries[country] = (stats.countries[country] || 0) + 1;
      stats.acquisitionSources[acquisition_source] =
        (stats.acquisitionSources[acquisition_source] || 0) + 1;
    } else if (eventType === "user-logged-in") {
      stats.logins++;
    }
  }

  // Calculate averages and prepare results
  const result = {
    monthlyStats: monthStats,
    dailyActiveUsers: dailyActiveUsers,
    totalUsers: new Set(data.map((e) => e.userId)).size,
    totalEvents: data.length,
    totalPageviews: data.length, // Every event is a pageview
  };

  return result;
}

// ----------------------
// Pretty CLI Output
// ----------------------
function displayAnalytics(result: ReturnType<typeof analyze>) {
  console.log("\n🚀 Syncora Analytics Dashboard");
  console.log("═══════════════════════════════════════════════════════════");

  console.log(`📊 Total Users: ${result.totalUsers}`);
  console.log(`📈 Total Events: ${result.totalEvents}`);
  console.log(`� Total Pageviews: ${result.totalPageviews}`);

  // Calculate DAU (Daily Active Users) statistics
  const dauValues = Object.values(result.dailyActiveUsers).map(
    (set) => set.size
  );
  const avgDAU =
    dauValues.length > 0
      ? (dauValues.reduce((a, b) => a + b, 0) / dauValues.length).toFixed(1)
      : "0";
  const maxDAU = dauValues.length > 0 ? Math.max(...dauValues) : 0;

  console.log(`📱 Average DAU: ${avgDAU}`);
  console.log(`🔥 Peak DAU: ${maxDAU}`);

  console.log("\n📅 Monthly Analytics Overview");
  console.log(
    "─────────────────────────────────────────────────────────────────────────"
  );
  console.log(
    "Month     Signups  Logins  Pageviews   MAU   Top Country   Top Source"
  );
  console.log(
    "─────────────────────────────────────────────────────────────────────────"
  );

  const months = Object.keys(result.monthlyStats).sort();

  for (const month of months) {
    const stats = result.monthlyStats[month];
    const monthName = getMonthName(month);
    const mau = stats.activeUsers.size;

    // Get top country
    const topCountry = Object.entries(stats.countries).sort(
      ([, a], [, b]) => b - a
    )[0];
    const topCountryName = topCountry ? topCountry[0] : "N/A";
    const topCountryCount = topCountry ? topCountry[1] : 0;

    // Get top acquisition source
    const topSource = Object.entries(stats.acquisitionSources).sort(
      ([, a], [, b]) => b - a
    )[0];
    const topSourceName = topSource ? topSource[0] : "N/A";
    const topSourceCount = topSource ? topSource[1] : 0;

    console.log(
      `${monthName}       ${pad(stats.signups)}    ${pad(
        stats.logins
      )}    ${pad(stats.pageviews)}     ${pad(
        mau
      )}   ${topCountryName}(${topCountryCount})   ${topSourceName}(${topSourceCount})`
    );
  }

  console.log("───────────────────────────────────────────────────────────");

  // Display country breakdown
  console.log("\n🌍 Geographic Distribution (Total Signups)");
  console.log("─────────────────────────────────────────");
  const allCountries: Record<string, number> = {};

  for (const month of months) {
    const stats = result.monthlyStats[month];
    for (const [country, count] of Object.entries(stats.countries)) {
      allCountries[country] = (allCountries[country] || 0) + count;
    }
  }

  const sortedCountries = Object.entries(allCountries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 countries

  for (const [country, count] of sortedCountries) {
    const percentage = ((count / result.totalUsers) * 100).toFixed(1);
    console.log(`${country.padEnd(20)} ${pad(count)} users (${percentage}%)`);
  }

  // Display acquisition source breakdown
  console.log("\n📈 Acquisition Channel Performance");
  console.log("─────────────────────────────────────");
  const allSources: Record<string, number> = {};

  for (const month of months) {
    const stats = result.monthlyStats[month];
    for (const [source, count] of Object.entries(stats.acquisitionSources)) {
      allSources[source] = (allSources[source] || 0) + count;
    }
  }

  const sortedSources = Object.entries(allSources).sort(
    ([, a], [, b]) => b - a
  );

  for (const [source, count] of sortedSources) {
    const percentage = ((count / result.totalUsers) * 100).toFixed(1);
    console.log(`${source.padEnd(15)} ${pad(count)} users (${percentage}%)`);
  }

  // Growth rate analysis
  console.log("\n📊 Month-over-Month Growth");
  console.log("─────────────────────────────");

  for (let i = 1; i < months.length; i++) {
    const currentMonth = months[i];
    const previousMonth = months[i - 1];
    const currentSignups = result.monthlyStats[currentMonth].signups;
    const previousSignups = result.monthlyStats[previousMonth].signups;

    const growthRate =
      previousSignups > 0
        ? (
            ((currentSignups - previousSignups) / previousSignups) *
            100
          ).toFixed(1)
        : "N/A";

    console.log(
      `${getMonthName(currentMonth)} vs ${getMonthName(
        previousMonth
      )}: ${growthRate}% growth`
    );
  }

  // Performance insights
  console.log("\n🎯 Key Performance Insights");
  console.log("─────────────────────────────────");

  // Calculate retention patterns
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const firstMonthUsers = result.monthlyStats[firstMonth].activeUsers.size;
  const lastMonthUsers = result.monthlyStats[lastMonth].activeUsers.size;
  const totalGrowthRate = (
    ((lastMonthUsers - firstMonthUsers) / firstMonthUsers) *
    100
  ).toFixed(1);

  console.log(
    `📈 Total user growth: ${totalGrowthRate}% (${firstMonthUsers} → ${lastMonthUsers} users)`
  );

  // Calculate average login frequency
  const totalLogins = months.reduce(
    (sum, month) => sum + result.monthlyStats[month].logins,
    0
  );
  const avgLoginsPerUser = (totalLogins / result.totalUsers).toFixed(1);
  console.log(`🔄 Average logins per user: ${avgLoginsPerUser}`);

  // Find most consistent growth regions
  const regionGrowth: Record<string, number[]> = {
    India: [],
    USA: [],
    Europe: [],
    UAE: [],
  };

  for (const month of months) {
    const stats = result.monthlyStats[month];
    regionGrowth.India.push(stats.countries["India"] || 0);
    regionGrowth.USA.push(stats.countries["United States"] || 0);

    let europeCount = 0;
    for (const [country, count] of Object.entries(stats.countries)) {
      if (
        [
          "United Kingdom",
          "Germany",
          "France",
          "Netherlands",
          "Sweden",
          "Spain",
          "Italy",
          "Switzerland",
          "Norway",
          "Finland",
          "Denmark",
        ].includes(country)
      ) {
        europeCount += count;
      }
    }
    regionGrowth.Europe.push(europeCount);
    regionGrowth.UAE.push(stats.countries["United Arab Emirates"] || 0);
  }

  // Calculate growth consistency (lower variance = more consistent)
  for (const [region, values] of Object.entries(regionGrowth)) {
    if (values.length > 1) {
      const growthRates: number[] = [];
      for (let i = 1; i < values.length; i++) {
        if (values[i - 1] > 0) {
          growthRates.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
        }
      }
      const avgGrowthRate =
        growthRates.length > 0
          ? (
              growthRates.reduce((sum, rate) => sum + rate, 0) /
              growthRates.length
            ).toFixed(1)
          : "0";
      console.log(`🌍 ${region} avg monthly growth: ${avgGrowthRate}%`);
    }
  }

  // DAU (Daily Active Users) Analysis - Month-wise
  console.log("\n📱 Daily Active Users (DAU) Analysis");
  console.log("──────────────────────────────────────");

  const dailyStats = Object.entries(result.dailyActiveUsers)
    .map(([date, users]) => ({ date, count: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dailyStats.length > 0) {
    // Overall DAU statistics
    const minDAU = Math.min(...dailyStats.map((d) => d.count));
    const maxDAU = Math.max(...dailyStats.map((d) => d.count));
    const avgDAU = (
      dailyStats.reduce((sum, d) => sum + d.count, 0) / dailyStats.length
    ).toFixed(1);

    console.log(`📊 Overall DAU Range: ${minDAU} - ${maxDAU} users`);
    console.log(`📈 Overall Average DAU: ${avgDAU} users`);

    // Month-wise DAU breakdown
    console.log("\n📅 Month-wise DAU Statistics");
    console.log("─────────────────────────────────────────────────────");
    console.log("Month     Avg DAU   Min DAU   Max DAU   Total Days");
    console.log("─────────────────────────────────────────────────────");

    // Group daily stats by month
    const monthlyDAU: Record<string, number[]> = {};

    dailyStats.forEach(({ date, count }) => {
      const month = date.substring(0, 7); // Extract YYYY-MM
      if (!monthlyDAU[month]) {
        monthlyDAU[month] = [];
      }
      monthlyDAU[month].push(count);
    });

    // Display month-wise DAU statistics
    const sortedMonths = Object.keys(monthlyDAU).sort();

    for (const month of sortedMonths) {
      const dauValues = monthlyDAU[month];
      const monthName = getMonthName(month);
      const avgMonthDAU = (
        dauValues.reduce((sum, val) => sum + val, 0) / dauValues.length
      ).toFixed(1);
      const minMonthDAU = Math.min(...dauValues);
      const maxMonthDAU = Math.max(...dauValues);
      const totalDays = dauValues.length;

      console.log(
        `${monthName}       ${pad(Number(avgMonthDAU), 6)}    ${pad(
          minMonthDAU,
          6
        )}    ${pad(maxMonthDAU, 6)}    ${pad(totalDays, 9)}`
      );
    }

    console.log("─────────────────────────────────────────────────────");

    // Month-over-Month DAU Growth
    console.log("\n📈 Month-over-Month DAU Growth");
    console.log("─────────────────────────────────");

    let previousMonthAvgDAU = 0;
    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const dauValues = monthlyDAU[month];
      const avgMonthDAU =
        dauValues.reduce((sum, val) => sum + val, 0) / dauValues.length;

      if (i > 0) {
        const growthRate = (
          ((avgMonthDAU - previousMonthAvgDAU) / previousMonthAvgDAU) *
          100
        ).toFixed(1);
        const growthColor = parseFloat(growthRate) >= 0 ? "📈" : "📉";
        console.log(
          `${growthColor} ${getMonthName(month)}: ${avgMonthDAU.toFixed(
            1
          )} DAU (${growthRate}% vs ${getMonthName(sortedMonths[i - 1])})`
        );
      } else {
        console.log(
          `📊 ${getMonthName(month)}: ${avgMonthDAU.toFixed(1)} DAU (baseline)`
        );
      }

      previousMonthAvgDAU = avgMonthDAU;
    }

    // Find peak activity day with month context
    const peakDay = dailyStats.reduce((max, current) =>
      current.count > max.count ? current : max
    );
    const peakMonth = getMonthName(peakDay.date.substring(0, 7));
    console.log(
      `\n🔥 Peak DAU: ${peakDay.count} users on ${peakDay.date} (${peakMonth})`
    );

    // Monthly DAU insights
    console.log("\n💡 Monthly DAU Insights");
    console.log("─────────────────────────");

    const bestDAUMonth = sortedMonths.reduce((best, month) => {
      const avgDAU =
        monthlyDAU[month].reduce((sum, val) => sum + val, 0) /
        monthlyDAU[month].length;
      const bestAvgDAU =
        monthlyDAU[best].reduce((sum, val) => sum + val, 0) /
        monthlyDAU[best].length;
      return avgDAU > bestAvgDAU ? month : best;
    });

    const bestAvgDAU = (
      monthlyDAU[bestDAUMonth].reduce((sum, val) => sum + val, 0) /
      monthlyDAU[bestDAUMonth].length
    ).toFixed(1);
    console.log(
      `🏆 Best performing month: ${getMonthName(
        bestDAUMonth
      )} (${bestAvgDAU} avg DAU)`
    );

    const mostConsistentMonth = sortedMonths.reduce((best, month) => {
      const values = monthlyDAU[month];
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
        values.length;

      const bestValues = monthlyDAU[best];
      const bestAvg =
        bestValues.reduce((sum, val) => sum + val, 0) / bestValues.length;
      const bestVariance =
        bestValues.reduce((sum, val) => sum + Math.pow(val - bestAvg, 2), 0) /
        bestValues.length;

      return variance < bestVariance ? month : best;
    });

    console.log(
      `📊 Most consistent month: ${getMonthName(
        mostConsistentMonth
      )} (lowest DAU variance)`
    );
  }

  console.log("\n═══════════════════════════════════════════════════════════");
}

function pad(n: number, width = 4) {
  return String(n).padStart(width, " ");
}

// ----------------------
// Country Distribution Table
// ----------------------
function displayCountryTable(result: ReturnType<typeof analyze>) {
  console.log("\n🌍 Country Distribution Table (Matching Original Data)");
  console.log("────────────────────────────────────────────────────────");
  console.log("Month\tIndia\tUSA\tEurope\tUAE\tSum");
  console.log("────────────────────────────────────────────────────────");

  const months = Object.keys(result.monthlyStats).sort();
  const tableData: Array<{
    month: string;
    India: number;
    USA: number;
    Europe: number;
    UAE: number;
    Sum: number;
  }> = [];

  for (const month of months) {
    const stats = result.monthlyStats[month];
    const monthName = getMonthName(month);

    // Count by region
    let indiaCount = 0;
    let usaCount = 0;
    let europeCount = 0;
    let uaeCount = 0;

    for (const [country, count] of Object.entries(stats.countries)) {
      if (country === "India") {
        indiaCount += count;
      } else if (country === "United States") {
        usaCount += count;
      } else if (country === "United Arab Emirates") {
        uaeCount += count;
      } else if (
        [
          "United Kingdom",
          "Germany",
          "France",
          "Netherlands",
          "Sweden",
          "Spain",
          "Italy",
          "Switzerland",
          "Norway",
          "Finland",
          "Denmark",
        ].includes(country)
      ) {
        europeCount += count;
      }
    }

    const sum = indiaCount + usaCount + europeCount + uaeCount;
    console.log(
      `${monthName}\t${indiaCount}\t${usaCount}\t${europeCount}\t${uaeCount}\t${sum}`
    );

    tableData.push({
      month: monthName,
      India: indiaCount,
      USA: usaCount,
      Europe: europeCount,
      UAE: uaeCount,
      Sum: sum,
    });
  }

  console.log("────────────────────────────────────────────────────────");

  // Save to file
  fs.writeFileSync(
    path.join(__dirname, "../country-breakdown.json"),
    JSON.stringify(tableData, null, 2)
  );
  console.log("💾 Country breakdown saved to country-breakdown.json");
}

// ----------------------
// Runner
// ----------------------
function run() {
  const filePath = path.join(__dirname, "../user-events.json");

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log("❌ User events file not found!");
    console.log("Please run 'bun run src/user.ts' first to generate the data.");
    return;
  }

  console.log("📖 Reading user events data...");
  const raw = fs.readFileSync(filePath, "utf8");
  const data: UserEvent[] = JSON.parse(raw);

  console.log(`✅ Loaded ${data.length} events`);

  const result = analyze(data);
  displayAnalytics(result);
  displayCountryTable(result);
}

run();
