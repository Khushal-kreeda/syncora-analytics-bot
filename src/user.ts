#!/usr/bin/env bun

import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────
interface UserSignUpEvent {
  email: string;
  userId: string;
  username: string;
  timestamp: string;
  event: "user-signed-up";
  acquisition_source:
    | "hugging_face"
    | "github"
    | "linkedin"
    | "twitter"
    | "google_seo"
    | "google_ads"
    | "direct"
    | "referral";
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
  acquisition_source:
    | "hugging_face"
    | "github"
    | "linkedin"
    | "twitter"
    | "google_seo"
    | "google_ads"
    | "direct"
    | "referral";
  country: string;
  isPaying: boolean;
  subscriptionType: string;
}

type UserEvent = UserSignUpEvent | UserLoginEvent;

interface User {
  id: string;
  email: string;
  username: string;
  signUpDate: Date;
  signUpMonth: string;
  acquisitionSource:
    | "hugging_face"
    | "github"
    | "linkedin"
    | "twitter"
    | "google_seo"
    | "google_ads"
    | "direct"
    | "referral";
  country: string;
  isPaying: boolean;
  subscriptionType: string;
}

// ── Monthly Growth Plan ──────────────────────────────────────
// Target metrics: Signups (45, 58, 74, 94, 120) with 13.5x login multiplier
// Reference: India=11,15,18,24,30 | USA=27,35,44,56,72 | Europe=5,6,7,9,12 | UAE=2,2,4,5,6
const MONTHLY_PLAN = [
  {
    month: "2025-01",
    signups: 45, // Exact target
    logins: 610, // 45 × 13.5 ≈ 610
    countryDistribution: {
      India: 11,
      USA: 27,
      Europe: 5,
      UAE: 2,
    },
    acquisitionSources: {
      hugging_face: faker.number.int({ min: 3, max: 6 }),
      github: faker.number.int({ min: 5, max: 9 }),
      linkedin: faker.number.int({ min: 3, max: 6 }),
      twitter: faker.number.int({ min: 7, max: 12 }),
      google_seo: faker.number.int({ min: 3, max: 6 }),
      google_ads: faker.number.int({ min: 3, max: 6 }),
      direct: faker.number.int({ min: 3, max: 6 }),
      referral: faker.number.int({ min: 5, max: 9 }),
    },
  },
  {
    month: "2025-02",
    signups: 58, // Exact target
    logins: 780, // 58 × 13.5 ≈ 780
    countryDistribution: {
      India: 15,
      USA: 35,
      Europe: 6,
      UAE: 2,
    },
    acquisitionSources: {
      hugging_face: faker.number.int({ min: 4, max: 8 }),
      github: faker.number.int({ min: 7, max: 12 }),
      linkedin: faker.number.int({ min: 4, max: 8 }),
      twitter: faker.number.int({ min: 9, max: 15 }),
      google_seo: faker.number.int({ min: 4, max: 8 }),
      google_ads: faker.number.int({ min: 4, max: 8 }),
      direct: faker.number.int({ min: 4, max: 8 }),
      referral: faker.number.int({ min: 7, max: 12 }),
    },
  },
  {
    month: "2025-03",
    signups: 74, // Exact target
    logins: 1000, // 74 × 13.5 ≈ 1000
    countryDistribution: {
      India: 18,
      USA: 44,
      Europe: 7,
      UAE: 4,
    },
    acquisitionSources: {
      hugging_face: faker.number.int({ min: 5, max: 9 }),
      github: faker.number.int({ min: 8, max: 14 }),
      linkedin: faker.number.int({ min: 5, max: 9 }),
      twitter: faker.number.int({ min: 12, max: 18 }),
      google_seo: faker.number.int({ min: 5, max: 9 }),
      google_ads: faker.number.int({ min: 5, max: 9 }),
      direct: faker.number.int({ min: 5, max: 9 }),
      referral: faker.number.int({ min: 8, max: 14 }),
    },
  },
  {
    month: "2025-04",
    signups: 94, // Exact target
    logins: 1270, // 94 × 13.5 ≈ 1270
    countryDistribution: {
      India: 24,
      USA: 56,
      Europe: 9,
      UAE: 5,
    },
    acquisitionSources: {
      hugging_face: faker.number.int({ min: 7, max: 12 }),
      github: faker.number.int({ min: 11, max: 17 }),
      linkedin: faker.number.int({ min: 7, max: 12 }),
      twitter: faker.number.int({ min: 15, max: 22 }),
      google_seo: faker.number.int({ min: 7, max: 12 }),
      google_ads: faker.number.int({ min: 7, max: 12 }),
      direct: faker.number.int({ min: 7, max: 12 }),
      referral: faker.number.int({ min: 11, max: 17 }),
    },
  },
  {
    month: "2025-05",
    signups: 120, // Exact target
    logins: 1620, // 120 × 13.5 = 1620
    countryDistribution: {
      India: 30,
      USA: 72,
      Europe: 12,
      UAE: 6,
    },
    acquisitionSources: {
      hugging_face: faker.number.int({ min: 9, max: 15 }),
      github: faker.number.int({ min: 14, max: 21 }),
      linkedin: faker.number.int({ min: 9, max: 15 }),
      twitter: faker.number.int({ min: 19, max: 27 }),
      google_seo: faker.number.int({ min: 9, max: 15 }),
      google_ads: faker.number.int({ min: 9, max: 15 }),
      direct: faker.number.int({ min: 9, max: 15 }),
      referral: faker.number.int({ min: 14, max: 21 }),
    },
  },
];

// ── Data Storage ─────────────────────────────────────────────
const allUsers: User[] = [];
const allEvents: UserEvent[] = [];

// ── Utility Functions ─────────────────────────────────────────
function getMonthRange(monthString: string): [Date, Date] {
  const [year, month] = monthString.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return [start, end];
}

function randomDateInRange(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateEmail(): string {
  return faker.internet.email().toLowerCase();
}

function generateUsername(): string {
  return faker.internet.username().toLowerCase();
}

function generateCountryForRegion(region: string): string {
  switch (region) {
    case "India":
      return "India";
    case "USA":
      return "United States";
    case "UAE":
      return "United Arab Emirates";
    case "Europe":
      // Realistic European countries for tech platforms
      const europeanCountries = [
        "United Kingdom", // 25% of Europe
        "Germany", // 20% of Europe
        "France", // 15% of Europe
        "Netherlands", // 10% of Europe
        "Sweden", // 8% of Europe
        "Spain", // 6% of Europe
        "Italy", // 5% of Europe
        "Switzerland", // 4% of Europe
        "Norway", // 3% of Europe
        "Finland", // 2% of Europe
        "Denmark", // 2% of Europe
      ];

      const weights = [25, 20, 15, 10, 8, 6, 5, 4, 3, 2, 2];
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < europeanCountries.length; i++) {
        if (random < weights[i]) {
          return europeanCountries[i];
        }
        random -= weights[i];
      }

      return "United Kingdom"; // fallback
    default:
      return "United States"; // fallback
  }
}

// ── Generate Users for Each Month ─────────────────────────────
function generateUsersForMonth(monthData: (typeof MONTHLY_PLAN)[0]): void {
  const [monthStart, monthEnd] = getMonthRange(monthData.month);

  // Calculate the actual target signups (sum of country distribution)
  const targetSignups = Object.values(monthData.countryDistribution).reduce(
    (sum, count) => sum + count,
    0
  );

  // Create array of countries based on the monthly plan
  const countryArray: string[] = [];
  Object.entries(monthData.countryDistribution).forEach(([region, count]) => {
    for (let i = 0; i < count; i++) {
      countryArray.push(generateCountryForRegion(region));
    }
  });

  // Create array of acquisition sources based on the monthly plan
  const acquisitionSourceArray: Array<
    keyof typeof monthData.acquisitionSources
  > = [];

  // First, calculate total from acquisition sources
  const totalAcquisitionSources = Object.values(
    monthData.acquisitionSources
  ).reduce((sum, count) => sum + count, 0);

  // If acquisition sources total matches target, use as-is
  if (totalAcquisitionSources === targetSignups) {
    Object.entries(monthData.acquisitionSources).forEach(([source, count]) => {
      for (let i = 0; i < count; i++) {
        acquisitionSourceArray.push(
          source as keyof typeof monthData.acquisitionSources
        );
      }
    });
  } else {
    // Scale acquisition sources proportionally to match target
    const sourceKeys = Object.keys(monthData.acquisitionSources) as Array<
      keyof typeof monthData.acquisitionSources
    >;

    for (let i = 0; i < targetSignups; i++) {
      const randomSource =
        sourceKeys[Math.floor(Math.random() * sourceKeys.length)];
      acquisitionSourceArray.push(randomSource);
    }
  }

  // Shuffle arrays to randomize order
  for (let i = countryArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [countryArray[i], countryArray[j]] = [countryArray[j], countryArray[i]];
  }

  for (let i = acquisitionSourceArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [acquisitionSourceArray[i], acquisitionSourceArray[j]] = [
      acquisitionSourceArray[j],
      acquisitionSourceArray[i],
    ];
  }

  // Generate users
  for (let i = 0; i < targetSignups; i++) {
    // Determine subscription status (10% chance of being a paying user)
    const isPaying = Math.random() < 0.1; // 10% conversion rate
    const subscriptionType = isPaying
      ? faker.helpers.arrayElement(["Pro", "Premium", "Enterprise"])
      : "Free";

    const user: User = {
      id: uuidv4(),
      email: generateEmail(),
      username: generateUsername(),
      signUpDate: randomDateInRange(monthStart, monthEnd),
      signUpMonth: monthData.month,
      acquisitionSource: acquisitionSourceArray[i] || acquisitionSourceArray[0],
      country: countryArray[i] || countryArray[0],
      isPaying: isPaying,
      subscriptionType: subscriptionType,
    };

    allUsers.push(user);

    // Create signup event
    const signupEvent: UserSignUpEvent = {
      email: user.email,
      userId: user.id,
      username: user.username,
      timestamp: user.signUpDate.toISOString(),
      event: "user-signed-up",
      acquisition_source: user.acquisitionSource,
      country: user.country,
      isPaying: user.isPaying,
      subscriptionType: user.subscriptionType,
    };

    allEvents.push(signupEvent);
  }

  // Display realistic signup analytics
  console.log(
    `📊 ${monthData.month}: \x1b[33m${targetSignups}\x1b[0m total signups`
  );
}

// ── Generate Login Events ─────────────────────────────────────
function generateLoginEventsForMonth(
  monthData: (typeof MONTHLY_PLAN)[0]
): void {
  const [monthStart, monthEnd] = getMonthRange(monthData.month);

  // Get all users who have signed up by this month (cumulative)
  const eligibleUsers = allUsers.filter((user) => user.signUpDate <= monthEnd);

  if (eligibleUsers.length === 0) {
    console.log(
      `   ❌ No eligible users for login events in ${monthData.month}`
    );
    return;
  }

  // Generate realistic login patterns with variation
  const targetLogins = monthData.logins;
  const loginEvents: UserLoginEvent[] = [];

  // Create user activity patterns (some users are more active than others)
  const userActivityWeights = new Map<string, number>();
  eligibleUsers.forEach((user) => {
    // Users who signed up earlier get higher activity weights
    const monthsSinceSignup =
      (monthEnd.getTime() - user.signUpDate.getTime()) /
      (1000 * 60 * 60 * 24 * 30);
    const baseWeight = Math.max(0.1, 1 - monthsSinceSignup * 0.1); // Decay over time but not to zero

    // Add some randomness - some users are just more active
    const randomMultiplier = 0.3 + Math.random() * 1.4; // 0.3x to 1.7x multiplier

    // Users from certain acquisition sources might be more engaged
    const sourceMultiplier =
      user.acquisitionSource === "github"
        ? 1.2
        : user.acquisitionSource === "referral"
        ? 1.3
        : user.acquisitionSource === "hugging_face"
        ? 1.1
        : 1.0;

    userActivityWeights.set(
      user.id,
      baseWeight * randomMultiplier * sourceMultiplier
    );
  });

  // Generate login events
  for (let i = 0; i < targetLogins; i++) {
    // Select user based on activity weights
    let totalWeight = 0;
    for (const weight of userActivityWeights.values()) {
      totalWeight += weight;
    }

    let randomValue = Math.random() * totalWeight;
    let selectedUser = eligibleUsers[0]; // fallback

    for (const user of eligibleUsers) {
      const weight = userActivityWeights.get(user.id) || 0.1;
      if (randomValue < weight) {
        selectedUser = user;
        break;
      }
      randomValue -= weight;
    }

    // Generate login timestamp with realistic patterns
    // More logins on weekdays, some variation throughout the day
    const loginStart = new Date(
      Math.max(selectedUser.signUpDate.getTime(), monthStart.getTime())
    );

    // Generate a random day in the month
    const randomDay = new Date(
      loginStart.getTime() +
        Math.random() * (monthEnd.getTime() - loginStart.getTime())
    );

    // Add time-of-day variation (more activity during business hours)
    const hour =
      Math.random() < 0.7
        ? faker.number.int({ min: 8, max: 18 }) // 70% business hours
        : faker.number.int({ min: 0, max: 23 }); // 30% any time

    const minute = faker.number.int({ min: 0, max: 59 });
    const loginTimestamp = new Date(
      randomDay.getFullYear(),
      randomDay.getMonth(),
      randomDay.getDate(),
      hour,
      minute
    );

    // Ensure timestamp is within valid range
    if (loginTimestamp >= loginStart && loginTimestamp <= monthEnd) {
      loginEvents.push({
        email: selectedUser.email,
        userId: selectedUser.id,
        username: selectedUser.username,
        timestamp: loginTimestamp.toISOString(),
        event: "user-logged-in",
        acquisition_source: selectedUser.acquisitionSource,
        country: selectedUser.country,
        isPaying: selectedUser.isPaying,
        subscriptionType: selectedUser.subscriptionType,
      });
    }
  }

  // Sort login events and add to main events array
  loginEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  allEvents.push(...loginEvents);

  console.log(`   🔄 \x1b[36m${loginEvents.length}\x1b[0m total logins`);
}

// ── Main Generation Function ──────────────────────────────────
function generateAllUserEvents(): void {
  console.log(
    "\n🚀 \x1b[36mSyncora Analytics Bot - User Event Generation\x1b[0m"
  );
  console.log("═".repeat(50));

  // Generate users and events for each month
  MONTHLY_PLAN.forEach((monthData) => {
    generateUsersForMonth(monthData);
    generateLoginEventsForMonth(monthData);
  });

  // Sort all events by timestamp
  allEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  console.log("\n" + "═".repeat(50));
  console.log("📈 \x1b[1m\x1b[32mANALYTICS SUMMARY\x1b[0m");
  console.log("═".repeat(50));
  console.log(`👥 Total signups: \x1b[33m${allUsers.length}\x1b[0m`);
  console.log(
    `🔄 Total logins: \x1b[33m${
      allEvents.filter((e) => e.event === "user-logged-in").length
    }\x1b[0m`
  );
  console.log(`📋 Total events tracked: \x1b[33m${allEvents.length}\x1b[0m`);

  // Show key monthly insights
  console.log("\n📊 \x1b[1m\x1b[35mMonthly Signup Growth\x1b[0m");
  console.log("─".repeat(30));

  let previousSignups = 0;
  MONTHLY_PLAN.forEach((monthData) => {
    const monthSignups = allEvents.filter(
      (e) =>
        e.event === "user-signed-up" && e.timestamp.startsWith(monthData.month)
    ).length;

    const growthRate =
      previousSignups > 0
        ? (((monthSignups - previousSignups) / previousSignups) * 100).toFixed(
            0
          )
        : "New";

    const growthColor =
      growthRate !== "New" && parseFloat(growthRate) >= 0
        ? "\x1b[32m"
        : "\x1b[31m";
    const growthDisplay =
      growthRate === "New"
        ? "\x1b[37mNew\x1b[0m"
        : `${growthColor}${growthRate}%\x1b[0m`;

    console.log(
      `${monthData.month}: \x1b[33m${monthSignups}\x1b[0m signups (${growthDisplay} growth)`
    );
    previousSignups = monthSignups;
  });

  // Show top countries and sources briefly
  const countryBreakdown: Record<string, number> = {};
  const acquisitionBreakdown: Record<string, number> = {};

  allUsers.forEach((user) => {
    countryBreakdown[user.country] = (countryBreakdown[user.country] || 0) + 1;
    acquisitionBreakdown[user.acquisitionSource] =
      (acquisitionBreakdown[user.acquisitionSource] || 0) + 1;
  });

  const topCountries = Object.entries(countryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topSources = Object.entries(acquisitionBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  console.log("\n🌍 \x1b[1mTop Countries\x1b[0m");
  topCountries.forEach(([country, count]) => {
    const percentage = ((count / allUsers.length) * 100).toFixed(0);
    console.log(
      `${country}: \x1b[33m${count}\x1b[0m signups (\x1b[36m${percentage}%\x1b[0m)`
    );
  });

  console.log("\n📡 \x1b[1mTop Acquisition Sources\x1b[0m");
  topSources.forEach(([source, count]) => {
    const percentage = ((count / allUsers.length) * 100).toFixed(0);
    console.log(
      `${source}: \x1b[33m${count}\x1b[0m signups (\x1b[36m${percentage}%\x1b[0m)`
    );
  });

  console.log("\n" + "═".repeat(50));
  console.log("✅ \x1b[1m\x1b[32mData generation completed!\x1b[0m");
  console.log("═".repeat(50));
}

// ── Advanced Monthly Analytics Function ────────────────────────
function displayAdvancedMonthlyAnalytics(): void {
  console.log("\n" + "═".repeat(80));
  console.log("📊 \x1b[1m\x1b[33mADVANCED MONTHLY ANALYTICS DASHBOARD\x1b[0m");
  console.log("═".repeat(80));

  const monthlyData = MONTHLY_PLAN.map((monthData, index) => {
    const monthUsers = allUsers.filter(
      (user) => user.signUpMonth === monthData.month
    );
    const monthEvents = allEvents.filter((e) =>
      e.timestamp.startsWith(monthData.month)
    );
    const monthSignups = monthEvents.filter(
      (e) => e.event === "user-signed-up"
    ).length;
    const monthLogins = monthEvents.filter(
      (e) => e.event === "user-logged-in"
    ).length;

    // Calculate metrics
    const cumulativeUsers = allUsers.filter(
      (user) => new Date(user.signUpDate) <= new Date(monthData.month + "-31")
    ).length;

    const retentionRate =
      index > 0 ? ((monthLogins / cumulativeUsers) * 100).toFixed(1) : "N/A";

    const avgLoginsPerUser =
      cumulativeUsers > 0 ? (monthLogins / cumulativeUsers).toFixed(2) : "0";

    // Country diversity (unique countries)
    const uniqueCountries = [...new Set(monthUsers.map((u) => u.country))]
      .length;

    // Top acquisition source for the month
    const acquisitionCounts: Record<string, number> = {};
    monthUsers.forEach((user) => {
      acquisitionCounts[user.acquisitionSource] =
        (acquisitionCounts[user.acquisitionSource] || 0) + 1;
    });
    const topAcquisition = Object.entries(acquisitionCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      month: monthData.month,
      signups: monthSignups,
      logins: monthLogins,
      cumulativeUsers,
      retentionRate,
      avgLoginsPerUser,
      uniqueCountries,
      topAcquisition: topAcquisition
        ? `${topAcquisition[0]} (${topAcquisition[1]})`
        : "N/A",
    };
  });

  // Display table header
  console.log(
    "\n┌─────────────┬─────────┬─────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┐"
  );
  console.log(
    "│    Month    │ Signups │ Logins  │ Cumulative  │ Retention % │ Avg Logins  │ Countries   │   Top Acquisition   │"
  );
  console.log(
    "├─────────────┼─────────┼─────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤"
  );

  monthlyData.forEach((data) => {
    const monthStr = data.month.padEnd(11);
    const signupsStr = data.signups.toString().padStart(7);
    const loginsStr = data.logins.toString().padStart(7);
    const cumulativeStr = data.cumulativeUsers.toString().padStart(11);
    const retentionStr = data.retentionRate.toString().padStart(11);
    const avgLoginsStr = data.avgLoginsPerUser.toString().padStart(11);
    const countriesStr = data.uniqueCountries.toString().padStart(11);
    const topAcqStr = data.topAcquisition.padEnd(19);

    console.log(
      `│ ${monthStr} │${signupsStr} │${loginsStr} │${cumulativeStr} │${retentionStr} │${avgLoginsStr} │${countriesStr} │ ${topAcqStr} │`
    );
  });

  console.log(
    "└─────────────┴─────────┴─────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘"
  );

  // Growth trends
  console.log("\n📈 \x1b[1m\x1b[32mGROWTH TRENDS\x1b[0m");
  console.log("─".repeat(50));

  for (let i = 1; i < monthlyData.length; i++) {
    const current = monthlyData[i];
    const previous = monthlyData[i - 1];
    const growthRate = (
      ((current.signups - previous.signups) / previous.signups) *
      100
    ).toFixed(1);
    const growthColor = parseFloat(growthRate) >= 0 ? "\x1b[32m" : "\x1b[31m";
    const growthSymbol = parseFloat(growthRate) >= 0 ? "📈" : "📉";

    console.log(
      `${growthSymbol} ${
        current.month
      }: ${growthColor}${growthRate}%\x1b[0m growth (${
        current.signups - previous.signups
      } new signups)`
    );
  }

  // Seasonal patterns
  console.log("\n🌟 \x1b[1m\x1b[35mKEY INSIGHTS\x1b[0m");
  console.log("─".repeat(50));

  const totalSignups = monthlyData.reduce((sum, m) => sum + m.signups, 0);
  const avgMonthlySignups = (totalSignups / monthlyData.length).toFixed(1);
  const peakMonth = monthlyData.reduce((max, current) =>
    current.signups > max.signups ? current : max
  );
  const bestRetentionMonth = monthlyData
    .filter((m) => m.retentionRate !== "N/A")
    .reduce((max, current) =>
      parseFloat(current.retentionRate) > parseFloat(max.retentionRate || "0")
        ? current
        : max
    );

  console.log(
    `💡 Average monthly signups: \x1b[33m${avgMonthlySignups}\x1b[0m`
  );
  console.log(
    `🏆 Peak signup month: \x1b[32m${peakMonth.month}\x1b[0m with \x1b[33m${peakMonth.signups}\x1b[0m signups`
  );
  console.log(
    `🎯 Best retention month: \x1b[32m${bestRetentionMonth.month}\x1b[0m with \x1b[33m${bestRetentionMonth.retentionRate}%\x1b[0m`
  );
  console.log(
    `🌍 Geographic diversity: \x1b[36m${
      [...new Set(allUsers.map((u) => u.country))].length
    }\x1b[0m unique countries`
  );

  const avgCountriesPerMonth = (
    monthlyData.reduce((sum, m) => sum + m.uniqueCountries, 0) /
    monthlyData.length
  ).toFixed(1);
  console.log(
    `📊 Average countries per month: \x1b[36m${avgCountriesPerMonth}\x1b[0m`
  );
}

// ── Export Functions ──────────────────────────────────────────
function saveEventsToFile(): void {
  const outputPath = path.join(process.cwd(), "user-events.json");

  fs.writeFileSync(outputPath, JSON.stringify(allEvents, null, 2));
  console.log(`\n💾 \x1b[32mSaved to:\x1b[0m \x1b[36m${outputPath}\x1b[0m`);
  console.log(
    `📊 \x1b[33m${allEvents.length}\x1b[0m events | \x1b[35m${(
      fs.statSync(outputPath).size / 1024
    ).toFixed(0)} KB\x1b[0m`
  );
}

// ── Dataset and Upload Functions ──────────────────────────────
// Store the whole dataset array in a variable
const dataset = allEvents;

function chunkArray<T>(array: T[], chunkSize: number = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadInChunks() {
  const CHUNK_SIZE = 100;

  // Transform events to PostHog format
  const transformedEvents = dataset.map((event) => ({
    event: event.event,
    distinct_id: event.userId,
    timestamp: event.timestamp,
    properties: {
      email: event.email,
      userId: event.userId,
      username: event.username,
      acquisition_source: event.acquisition_source,
      country: event.country,
      isPaying: event.isPaying,
      subscriptionType: event.subscriptionType,
      $set: {
        email: event.email,
        username: event.username,
        country: event.country,
        acquisition_source: event.acquisition_source,
        isPaying: event.isPaying,
        subscriptionType: event.subscriptionType,
      },
    },
  }));

  const chunks = chunkArray(transformedEvents, CHUNK_SIZE);

  console.log(
    `🚀 Starting upload of ${transformedEvents.length} events in ${chunks.length} chunks...`
  );

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      api_key: "phc_hDkr9yTKLmTy6aUnkIgvempgdRlfxGIxmnXatfn5PQ3",
      historical_migration: true,
      batch: chunks[i],
    };

    try {
      await axios.post("https://us.posthog.com/batch/", payload);
      console.log(`✅ Uploaded batch ${i + 1}/${chunks.length}`);
    } catch (error) {
      console.error(
        `❌ Error uploading batch ${i + 1}:`,
        //@ts-ignore
        error.response?.data || error.message
      );
      process.exit(1);
    }
  }

  console.log(
    `🎉 Successfully uploaded all ${transformedEvents.length} events to PostHog!`
  );
}

// ── Main Execution ────────────────────────────────────────────
if (require.main === module) {
  generateAllUserEvents();
  saveEventsToFile();
  uploadInChunks();
}

// ── Exports ────────────────────────────────────────────────────
export {
  generateAllUserEvents,
  displayAdvancedMonthlyAnalytics,
  saveEventsToFile,
  chunkArray,
  uploadInChunks,
  dataset,
  allUsers,
  allEvents,
  UserEvent,
  UserSignUpEvent,
  UserLoginEvent,
  User,
};
