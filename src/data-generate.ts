#!/usr/bin/env bun

import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

// ── Types ─────────────────────────────────────────────────────
interface DataEvent {
  event: "data_generated";
  words: number;
  file_size: number; // in MB
  email: string;
  timestamp: string;
  user_id?: string;
  data_type: "jsonl";
  projectId: string;
}

interface User {
  id: string;
  email: string;
  signUpMonth: string;
  signUpDate: Date;
}

// ── Data Generation Plan ──────────────────────────────────────
const MONTHS_PLAN = [
  {
    month: "2025-01",
    newSignups: 45,
    dailyAvgMin: 1,
    dailyAvgMax: 2,
    totalWords: 8100000, // 8.1M
    activityRate: 0.85, // 85% of users generate data (early adopters are more active)
  },
  {
    month: "2025-02",
    newSignups: 58,
    dailyAvgMin: 2,
    dailyAvgMax: 2,
    totalWords: 10400000, // 10.4M
    activityRate: 0.82, // 82% activity rate
  },
  {
    month: "2025-03",
    newSignups: 74,
    dailyAvgMin: 2,
    dailyAvgMax: 3,
    totalWords: 13300000, // 13.3M
    activityRate: 0.78, // 78% activity rate (more users, lower percentage active)
  },
  {
    month: "2025-04",
    newSignups: 94,
    dailyAvgMin: 3,
    dailyAvgMax: 3,
    totalWords: 16900000, // 16.9M
    activityRate: 0.75, // 75% activity rate
  },
  {
    month: "2025-05",
    newSignups: 120,
    dailyAvgMin: 4,
    dailyAvgMax: 4,
    totalWords: 21600000, // 21.6M
    activityRate: 0.72, // 72% activity rate (larger user base, more inactive users)
  },
];

// ── User Management ───────────────────────────────────────────
const allUsers: User[] = [];
const dataEvents: DataEvent[] = [];

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

function calculateFileSize(wordCount: number): number {
  // Approximate file size calculation:
  // Average word length: 5 characters
  // Add spaces, formatting, metadata
  // Rough estimate: 1 word ≈ 6-8 bytes for plain text
  // For documents with formatting: 1 word ≈ 10-15 bytes
  const avgBytesPerWord = faker.number.int({ min: 8, max: 12 });
  const sizeInBytes = wordCount * avgBytesPerWord;
  // Convert to MB
  return sizeInBytes / (1024 * 1024);
}

function generateWordsCount(targetAvg: number): number {
  // Generate word count around the target with realistic variation
  const variation = faker.number.float({ min: 0.5, max: 1.5 });
  const wordCount = Math.round(targetAvg * variation);

  // Ensure minimum realistic word count
  return Math.max(wordCount, 25);
}

// ── Generate Users for Each Month ─────────────────────────────
function generateUsersForMonth(monthData: (typeof MONTHS_PLAN)[0]): void {
  const [monthStart, monthEnd] = getMonthRange(monthData.month);

  for (let i = 0; i < monthData.newSignups; i++) {
    const user: User = {
      id: uuidv4(),
      email: generateEmail(),
      signUpMonth: monthData.month,
      signUpDate: randomDateInRange(monthStart, monthEnd),
    };

    allUsers.push(user);
  }
}

// ── Generate Data Events for Active Users ────────────────────
function generateDataEventsForMonth(monthData: (typeof MONTHS_PLAN)[0]): void {
  const [monthStart, monthEnd] = getMonthRange(monthData.month);
  const daysInMonth = new Date(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0
  ).getDate();

  // Get all users who have signed up by this month (includes users from previous months)
  const allActiveUsers = allUsers.filter((user) => user.signUpDate <= monthEnd);

  // Apply activity rate - not all users generate data (costs money)
  const activeDataGenerators = allActiveUsers.filter(
    () => Math.random() < monthData.activityRate
  );

  console.log(`\n📊 Generating data events for ${monthData.month}`);
  console.log(`   Target: ${monthData.totalWords.toLocaleString()} words`);
  console.log(`   Total users: ${allActiveUsers.length}`);
  console.log(
    `   Active data generators: ${activeDataGenerators.length} (${(
      monthData.activityRate * 100
    ).toFixed(0)}% activity rate)`
  );

  let eventsGenerated = 0;
  let totalWordsGenerated = 0;
  let totalFileSizeGenerated = 0;

  // Generate events for each day with a two-phase approach
  // Phase 1: Generate events based on daily activity patterns
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)
    );

    // Get users who have signed up by this specific day (from active data generators)
    const eligibleUsers = activeDataGenerators.filter(
      (user) => user.signUpDate <= currentDate
    );

    if (eligibleUsers.length === 0) continue;

    // Calculate events for today based on daily average range
    const avgEventsPerUser = faker.number.float({
      min: monthData.dailyAvgMin,
      max: monthData.dailyAvgMax,
    });
    const eventsForToday = Math.round(eligibleUsers.length * avgEventsPerUser);

    // Generate events for today with base word counts
    for (let eventIndex = 0; eventIndex < eventsForToday; eventIndex++) {
      const user = faker.helpers.arrayElement(eligibleUsers);
      const eventTime = randomDateInRange(
        currentDate,
        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      );

      // Generate base word count (we'll adjust later to meet target)
      const baseWordsGenerated = faker.number.int({ min: 500, max: 2000 });
      const fileSize = calculateFileSize(baseWordsGenerated);

      const dataEvent: DataEvent = {
        event: "data_generated",
        words: baseWordsGenerated,
        file_size: fileSize,
        email: user.email,
        timestamp: eventTime.toISOString(),
        user_id: user.id,
        data_type: "jsonl",
        projectId: uuidv4(),
      };

      dataEvents.push(dataEvent);
      eventsGenerated++;
      totalWordsGenerated += baseWordsGenerated;
      totalFileSizeGenerated += fileSize;
    }
  }

  // Phase 2: Adjust to meet or exceed the monthly target (but not excessively)
  const wordsDeficit = monthData.totalWords - totalWordsGenerated;

  if (wordsDeficit > 0) {
    // Find events from this month to boost
    const monthEvents = dataEvents.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });

    if (monthEvents.length > 0) {
      // Distribute the deficit across existing events
      const extraWordsPerEvent = Math.ceil(wordsDeficit / monthEvents.length);

      for (const event of monthEvents) {
        const additionalWords = faker.number.int({
          min: Math.floor(extraWordsPerEvent * 0.5),
          max: Math.floor(extraWordsPerEvent * 1.5),
        });

        event.words += additionalWords;
        event.file_size = calculateFileSize(event.words);
        totalWordsGenerated += additionalWords;

        // Break if we've met the target (allow some overage but not excessive)
        if (totalWordsGenerated >= monthData.totalWords) {
          break;
        }
      }
    }
  } else if (totalWordsGenerated > monthData.totalWords * 1.2) {
    // If we're generating way too much (>120% of target), scale back
    const monthEvents = dataEvents.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });

    // Calculate scale factor to get closer to target (with 10-15% overage)
    const targetWithBuffer =
      monthData.totalWords * faker.number.float({ min: 1.05, max: 1.15 });
    const scaleFactor = targetWithBuffer / totalWordsGenerated;

    totalWordsGenerated = 0; // Recalculate

    for (const event of monthEvents) {
      const newWordCount = Math.max(100, Math.round(event.words * scaleFactor));

      event.words = newWordCount;
      event.file_size = calculateFileSize(event.words);
      totalWordsGenerated += event.words;
    }
  }

  // Recalculate total file size after adjustments
  const monthEvents = dataEvents.filter((event) => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= monthStart && eventDate <= monthEnd;
  });

  totalFileSizeGenerated = monthEvents.reduce(
    (sum, event) => sum + event.file_size,
    0
  );

  // Calculate target match percentage
  const targetMatchPercentage =
    (totalWordsGenerated / monthData.totalWords) * 100;

  // Calculate average file size per event for this month
  const avgFileSizePerEvent =
    eventsGenerated > 0 ? totalFileSizeGenerated / eventsGenerated : 0;

  console.log(`   Words generated: ${totalWordsGenerated.toLocaleString()}`);
  console.log(`   Target match: ${targetMatchPercentage.toFixed(1)}%`);
  console.log(`   Events generated: ${eventsGenerated.toLocaleString()}`);
  console.log(
    `   Avg file size per event: ${avgFileSizePerEvent.toFixed(4)} MB`
  );

  // Add simple status indicator
  if (targetMatchPercentage >= 100) {
    console.log(`   ✅ Target achieved`);
  } else {
    console.log(`   ⚠️ Target not fully met`);
  }
}

// ── Save Data to JSON File ───────────────────────────────────
function saveDataToFile(): void {
  const outputPath = path.join(__dirname, "../data-generated.json");

  try {
    fs.writeFileSync(outputPath, JSON.stringify(dataEvents, null, 2));
    console.log("✅ Data successfully saved to data-generated.json");
  } catch (error) {
    console.error("❌ Error saving data to file:", error);
    throw error;
  }
}

// ── Main Execution ───────────────────────────────────────────
async function main(): Promise<void> {
  console.log("🎯 Starting Data Generation Script");
  console.log("==================================");

  try {
    // Generate users for each month
    for (const monthData of MONTHS_PLAN) {
      generateUsersForMonth(monthData);
    }

    console.log(`\n👥 Total users created: ${allUsers.length}`);

    // Generate data events for each month
    for (const monthData of MONTHS_PLAN) {
      generateDataEventsForMonth(monthData);
    }

    console.log(`\n📈 Total data events created: ${dataEvents.length}`);

    // Calculate overall statistics
    const totalTargetWords = MONTHS_PLAN.reduce(
      (sum, month) => sum + month.totalWords,
      0
    );
    const totalActualWords = dataEvents.reduce(
      (sum, event) => sum + event.words,
      0
    );
    const totalFileSize = dataEvents.reduce(
      (sum, event) => sum + event.file_size,
      0
    );
    const overallTargetMatch = (totalActualWords / totalTargetWords) * 100;

    console.log("\n🎯 Overall Summary:");
    console.log(`   Target total words: ${totalTargetWords.toLocaleString()}`);
    console.log(`   Actual total words: ${totalActualWords.toLocaleString()}`);
    console.log(`   Overall target match: ${overallTargetMatch.toFixed(1)}%`);
    console.log(`   Total file size generated: ${totalFileSize.toFixed(2)} MB`);

    // Save to JSON file
    saveDataToFile();

    console.log("\n🎉 Data generation completed successfully!");
  } catch (error) {
    console.error("❌ Error in data generation:", error);
    process.exit(1);
  }
}

function run() {
  main();
}

// Run the script if called directly
if (require.main === module) {
  run();
}

export { main as generateDataEvents };
