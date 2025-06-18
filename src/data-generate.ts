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
    targetFileSize: 4.5 * 1024 * 1024 * 1024, // 4.5 GB in bytes
    activityRate: 0.85, // 85% of users generate data (early adopters are more active)
  },
  {
    month: "2025-02",
    newSignups: 58,
    dailyAvgMin: 2,
    dailyAvgMax: 2,
    targetFileSize: 7.2 * 1024 * 1024 * 1024, // 7.2 GB in bytes
    activityRate: 0.82, // 82% activity rate
  },
  {
    month: "2025-03",
    newSignups: 74,
    dailyAvgMin: 2,
    dailyAvgMax: 3,
    targetFileSize: 13.3 * 1024 * 1024 * 1024, // 13.3 GB in bytes
    activityRate: 0.78, // 78% activity rate (more users, lower percentage active)
  },
  {
    month: "2025-04",
    newSignups: 94,
    dailyAvgMin: 3,
    dailyAvgMax: 3,
    targetFileSize: 18.6 * 1024 * 1024 * 1024, // 18.6 GB in bytes
    activityRate: 0.75, // 75% activity rate
  },
  {
    month: "2025-05",
    newSignups: 120,
    dailyAvgMin: 4,
    dailyAvgMax: 4,
    targetFileSize: 21.6 * 1024 * 1024 * 1024, // 21.6 GB in bytes
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
  // CORRECTED: Actual test results show JSONL data averages ~8.6 bytes per word
  // Test results from test-jsonl-assumptions.ts:
  // - Average: 8.64 bytes per word across different word counts (100-50k words)
  // - Range: 8.22 - 9.79 bytes per word
  // - Previous assumption of 12-18 bytes/word was overestimating by ~75%

  // Use realistic range with some variation for different content types
  const avgBytesPerWord = faker.number.float({ min: 8.0, max: 9.5 });
  const sizeInBytes = wordCount * avgBytesPerWord;
  // Convert to MB
  return sizeInBytes / (1024 * 1024);
}

function calculateWordsFromFileSize(fileSizeMB: number): number {
  // Reverse calculation: estimate words needed for target file size
  // Updated to use corrected average of 8.6 bytes per word
  const fileSizeBytes = fileSizeMB * 1024 * 1024;
  const avgBytesPerWord = 8.6; // Based on actual test results
  return Math.round(fileSizeBytes / avgBytesPerWord);
}

function generateFileSizeForEvent(targetAvgSizeMB: number): number {
  // Generate file size around the target with realistic variation
  // Increased multipliers to generate larger files on average and ensure we meet targets
  const variation = faker.number.float({ min: 0.8, max: 4.0 }); // Increased range with higher minimum
  const fileSize = targetAvgSizeMB * variation;

  // Ensure minimum realistic file size (0.2 MB minimum, increased from 0.1)
  return Math.max(fileSize, 0.2);
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

  const targetFileSizeGB = monthData.targetFileSize / (1024 * 1024 * 1024);
  const targetFileSizeMB = monthData.targetFileSize / (1024 * 1024);

  console.log(`\n📊 Generating data events for ${monthData.month}`);
  console.log(
    `   Target: ${targetFileSizeGB.toFixed(2)} GB | Users: ${
      activeDataGenerators.length
    }/${allActiveUsers.length} active`
  );

  let eventsGenerated = 0;
  let totalFileSizeGenerated = 0;

  // Estimate total events needed for the month
  const avgEventsPerUser = (monthData.dailyAvgMin + monthData.dailyAvgMax) / 2;
  const estimatedTotalEvents = Math.round(
    activeDataGenerators.length * avgEventsPerUser * daysInMonth
  );

  // Calculate target average file size per event
  const targetAvgFileSizePerEventMB = targetFileSizeMB / estimatedTotalEvents;

  // Generate events for each day with file size-based approach
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

    // Generate events for today with file size as primary constraint
    for (let eventIndex = 0; eventIndex < eventsForToday; eventIndex++) {
      const user = faker.helpers.arrayElement(eligibleUsers);
      const eventTime = randomDateInRange(
        currentDate,
        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      );

      // Generate file size based on target with variation
      const fileSize = generateFileSizeForEvent(targetAvgFileSizePerEventMB);

      // Calculate words based on file size
      const wordsGenerated = calculateWordsFromFileSize(fileSize);

      const dataEvent: DataEvent = {
        event: "data_generated",
        words: wordsGenerated,
        file_size: fileSize,
        email: user.email,
        timestamp: eventTime.toISOString(),
        user_id: user.id,
        data_type: "jsonl",
        projectId: uuidv4(),
      };

      dataEvents.push(dataEvent);
      eventsGenerated++;
      totalFileSizeGenerated += fileSize;
    }
  }

  // Phase 2: Adjust to meet the monthly file size target
  // Always ensure we meet or exceed target by 10-15%, never go below
  const targetMinimum = targetFileSizeMB; // Never go below 100% of target
  const targetIdeal =
    targetFileSizeMB * faker.number.float({ min: 1.1, max: 1.15 }); // 10-15% over target

  let monthEvents = dataEvents.filter((event) => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= monthStart && eventDate <= monthEnd;
  });

  if (totalFileSizeGenerated < targetMinimum) {
    // We're below target - MUST boost to at least 100% of target, preferably 10-15% over
    const deficitToMinimum = targetMinimum - totalFileSizeGenerated;
    const extraToIdeal = targetIdeal - targetMinimum;
    const totalIncrease = deficitToMinimum + extraToIdeal;

    if (monthEvents.length > 0) {
      const extraFileSizePerEvent = totalIncrease / monthEvents.length;

      for (const event of monthEvents) {
        const additionalFileSize = faker.number.float({
          min: extraFileSizePerEvent * 0.8, // Ensure we get enough boost
          max: extraFileSizePerEvent * 1.5,
        });

        event.file_size += additionalFileSize;
        event.words = calculateWordsFromFileSize(event.file_size);
        totalFileSizeGenerated += additionalFileSize;

        // Stop if we've reached our ideal range (10-15% over)
        if (totalFileSizeGenerated >= targetIdeal) {
          break;
        }
      }
    }
  } else if (totalFileSizeGenerated > targetFileSizeMB * 1.2) {
    // Only scale back if we're significantly over 20% (too much overage)
    const targetWithBuffer = targetFileSizeMB * 1.15; // Scale back to 15% max
    const scaleFactor = targetWithBuffer / totalFileSizeGenerated;

    totalFileSizeGenerated = 0; // Recalculate

    for (const event of monthEvents) {
      const newFileSize = Math.max(0.1, event.file_size * scaleFactor);

      event.file_size = newFileSize;
      event.words = calculateWordsFromFileSize(event.file_size);
      totalFileSizeGenerated += event.file_size;
    }
  }

  // Recalculate total file size after adjustments
  totalFileSizeGenerated = monthEvents.reduce(
    (sum, event) => sum + event.file_size,
    0
  );

  // Calculate statistics
  const totalWordsGenerated = monthEvents.reduce(
    (sum, event) => sum + event.words,
    0
  );
  const targetMatchPercentage =
    (totalFileSizeGenerated / targetFileSizeMB) * 100;
  const finalFileSizeGB = totalFileSizeGenerated / 1024;
  const wordsInMillions = totalWordsGenerated / 1000000;

  console.log(
    `   Generated: ${finalFileSizeGB.toFixed(2)} GB | ${wordsInMillions.toFixed(
      1
    )}M words | ${eventsGenerated.toLocaleString()} events | ${targetMatchPercentage.toFixed(
      1
    )}% match`
  );

  // Add simple status indicator - updated to require minimum 100% of target
  if (targetMatchPercentage >= 100 && targetMatchPercentage <= 115) {
    console.log(`   ✅ Target achieved (${targetMatchPercentage.toFixed(1)}%)`);
  } else if (targetMatchPercentage > 115) {
    console.log(`   ⚠️ Over target (${targetMatchPercentage.toFixed(1)}%)`);
  } else {
    console.log(
      `   ❌ Under target (${targetMatchPercentage.toFixed(1)}%) - ERROR!`
    );
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

    // Calculate monthly breakdown
    console.log("\n📅 Monthly Breakdown:");
    for (const monthData of MONTHS_PLAN) {
      const [monthStart, monthEnd] = getMonthRange(monthData.month);
      const monthEvents = dataEvents.filter((event) => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= monthStart && eventDate <= monthEnd;
      });

      const monthWords = monthEvents.reduce(
        (sum, event) => sum + event.words,
        0
      );
      const monthFileSize = monthEvents.reduce(
        (sum, event) => sum + event.file_size,
        0
      );
      const monthWordsInMillions = monthWords / 1000000;
      const monthFileSizeGB = monthFileSize / 1024;

      console.log(
        `   ${monthData.month}: ${monthFileSizeGB.toFixed(
          2
        )} GB | ${monthWordsInMillions.toFixed(1)}M words | ${
          monthEvents.length
        } events`
      );
    }

    // Calculate overall statistics
    const totalTargetFileSize = MONTHS_PLAN.reduce(
      (sum, month) => sum + month.targetFileSize,
      0
    );
    const totalActualWords = dataEvents.reduce(
      (sum, event) => sum + event.words,
      0
    );
    const totalFileSizeBytes = dataEvents.reduce(
      (sum, event) => sum + event.file_size * 1024 * 1024, // Convert MB to bytes
      0
    );
    const totalFileSizeGB = totalFileSizeBytes / (1024 * 1024 * 1024);
    const totalTargetFileSizeGB = totalTargetFileSize / (1024 * 1024 * 1024);
    const overallFileSizeMatch =
      (totalFileSizeBytes / totalTargetFileSize) * 100;
    const totalWordsInMillions = totalActualWords / 1000000;

    console.log("\n🎯 Overall Summary:");
    console.log(
      `   File Size: ${totalFileSizeGB.toFixed(
        2
      )} GB / ${totalTargetFileSizeGB.toFixed(
        2
      )} GB (${overallFileSizeMatch.toFixed(1)}% match)`
    );
    console.log(`   Total Words: ${totalWordsInMillions.toFixed(1)}M words`);
    console.log(
      `   Average: ${(
        totalFileSizeBytes /
        (1024 * 1024) /
        dataEvents.length
      ).toFixed(2)} MB per event`
    );

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
