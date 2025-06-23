#!/usr/bin/env bun

import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

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

interface JobFailedEvent {
  event: "job_failed";
  error_code: string;
  error_message: string;
  email: string;
  timestamp: string;
  user_id?: string;
  projectId: string;
}

interface DataDownloadEvent {
  event: "data_downloaded";
  file_size: number; // in MB
  words: number;
  email: string;
  timestamp: string;
  user_id?: string;
  projectId: string;
}

type AllEvents = DataEvent | JobFailedEvent | DataDownloadEvent;

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
    dailyAvgMin: 0.3, // Reduced from 1-2 to 0.3-0.5 (fewer events)
    dailyAvgMax: 0.5,
    targetFileSize: 4.5 * 1024 * 1024 * 1024, // 4.5 GB in bytes
    activityRate: 0.85, // 85% of users generate data (early adopters are more active)
    targetDataGenerationMultiplier: 5.5, // 5.5x data generations relative to active users
  },
  {
    month: "2025-02",
    newSignups: 58,
    dailyAvgMin: 0.4, // Reduced from 2-2 to 0.4-0.6
    dailyAvgMax: 0.6,
    targetFileSize: 7.2 * 1024 * 1024 * 1024, // 7.2 GB in bytes
    activityRate: 0.82, // 82% activity rate
    targetDataGenerationMultiplier: 5.8, // 5.8x data generations relative to active users
  },
  {
    month: "2025-03",
    newSignups: 74,
    dailyAvgMin: 0.5, // Reduced from 2-3 to 0.5-0.7
    dailyAvgMax: 0.7,
    targetFileSize: 13.3 * 1024 * 1024 * 1024, // 13.3 GB in bytes
    activityRate: 0.78, // 78% activity rate (more users, lower percentage active)
    targetDataGenerationMultiplier: 6.0, // 6x data generations relative to active users
  },
  {
    month: "2025-04",
    newSignups: 94,
    dailyAvgMin: 0.6, // Reduced from 3-3 to 0.6-0.8
    dailyAvgMax: 0.8,
    targetFileSize: 18.6 * 1024 * 1024 * 1024, // 18.6 GB in bytes
    activityRate: 0.75, // 75% activity rate
    targetDataGenerationMultiplier: 6.2, // 6.2x data generations relative to active users
  },
  {
    month: "2025-05",
    newSignups: 120,
    dailyAvgMin: 0.7, // Reduced from 4-4 to 0.7-1.0
    dailyAvgMax: 1.0,
    targetFileSize: 21.6 * 1024 * 1024 * 1024, // 21.6 GB in bytes
    activityRate: 0.72, // 72% activity rate (larger user base, more inactive users)
    targetDataGenerationMultiplier: 6.5, // 6.5x data generations relative to active users
  },
];

// ── User Management ───────────────────────────────────────────
const allUsers: User[] = [];
const allEvents: AllEvents[] = [];

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
  // Generate larger file sizes with more variation to reduce total events
  // Increased multipliers significantly to generate much larger files on average
  const variation = faker.number.float({ min: 2.0, max: 8.0 }); // Increased from 0.8-4.0 to 2.0-8.0
  const fileSize = targetAvgSizeMB * variation;

  // Ensure minimum realistic file size (1.0 MB minimum, increased from 0.2)
  return Math.max(fileSize, 1.0);
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

  // Calculate target number of data generations based on multiplier
  const targetDataGenerations = Math.round(
    activeDataGenerators.length * monthData.targetDataGenerationMultiplier
  );

  let eventsGenerated = 0;
  let totalFileSizeGenerated = 0;

  // Calculate target average file size per event based on reduced event count
  const targetAvgFileSizePerEventMB = targetFileSizeMB / targetDataGenerations;

  // Generate events distributed across the month to reach target count
  const eventsPerDay = Math.ceil(targetDataGenerations / daysInMonth);

  // Generate events for each day with enhanced file size-based approach
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)
    );

    // Get users who have signed up by this specific day (from active data generators)
    const eligibleUsers = activeDataGenerators.filter(
      (user) => user.signUpDate <= currentDate
    );

    if (eligibleUsers.length === 0) continue;

    // Calculate events for today - distribute evenly across the month
    const remainingDays = daysInMonth - day + 1;
    const remainingEvents = targetDataGenerations - eventsGenerated;
    const eventsForToday = Math.min(
      Math.ceil(remainingEvents / remainingDays),
      eligibleUsers.length * 2 // Cap at 2 events per user per day max
    );

    // Generate events for today with larger file sizes
    for (let eventIndex = 0; eventIndex < eventsForToday; eventIndex++) {
      if (eventsGenerated >= targetDataGenerations) break;

      const user = faker.helpers.arrayElement(eligibleUsers);
      const eventTime = randomDateInRange(
        currentDate,
        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      );

      // Generate larger file size based on target with increased variation
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

      allEvents.push(dataEvent);
      eventsGenerated++;
      totalFileSizeGenerated += fileSize;

      // Track successful data generation for download creation
      let jobSuccessful = true;

      // 3% chance to generate a job_failed event
      if (Math.random() < 0.03) {
        jobSuccessful = false; // Job failed, no download will be created

        const errorMessages = [
          "Insufficient storage space",
          "Network timeout during processing",
          "Invalid data format detected",
          "Memory allocation failed",
          "Processing quota exceeded",
          "Authentication token expired",
          "Database connection lost",
          "File corruption detected",
        ];

        const errorCodes = [
          "STORAGE_FULL",
          "NETWORK_TIMEOUT",
          "INVALID_FORMAT",
          "MEMORY_ERROR",
          "QUOTA_EXCEEDED",
          "AUTH_EXPIRED",
          "DB_CONNECTION_LOST",
          "FILE_CORRUPTED",
        ];

        const errorIndex = Math.floor(Math.random() * errorMessages.length);
        const jobFailedEvent: JobFailedEvent = {
          event: "job_failed",
          error_code: errorCodes[errorIndex],
          error_message: errorMessages[errorIndex],
          email: user.email,
          timestamp: new Date(
            eventTime.getTime() + Math.random() * 3600000
          ).toISOString(), // Within 1 hour of data generation
          user_id: user.id,
          projectId: dataEvent.projectId,
        };

        allEvents.push(jobFailedEvent);
      }

      // Create exactly one download event for each successful data generation
      // Only if the job was successful (no failure occurred)
      if (jobSuccessful) {
        const downloadEvent: DataDownloadEvent = {
          event: "data_downloaded",
          file_size: fileSize,
          words: wordsGenerated, // Include words in download event
          email: user.email,
          timestamp: new Date(
            eventTime.getTime() + Math.random() * 86400000
          ).toISOString(), // Within 24 hours of data generation
          user_id: user.id,
          projectId: dataEvent.projectId,
        };

        allEvents.push(downloadEvent);
      }
    }
  }

  // Phase 2: Adjust to meet the monthly file size target
  // Always ensure we meet or exceed target by 10-15%, never go below
  const targetMinimum = targetFileSizeMB; // Never go below 100% of target
  const targetIdeal =
    targetFileSizeMB * faker.number.float({ min: 1.1, max: 1.15 }); // 10-15% over target

  let monthEvents = allEvents.filter((event) => {
    const eventDate = new Date(event.timestamp);
    return (
      eventDate >= monthStart &&
      eventDate <= monthEnd &&
      event.event === "data_generated"
    );
  }) as DataEvent[];

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
}

// ── Save Data to JSON File ───────────────────────────────────
function saveDataToFile(): void {
  const outputPath = path.join(__dirname, "../data-generated.json");

  try {
    fs.writeFileSync(outputPath, JSON.stringify(allEvents, null, 2));
  } catch (error) {
    console.error("❌ Error saving data to file:", error);
    throw error;
  }
}

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
    distinct_id: event.user_id,
    timestamp: event.timestamp,
    properties: {
      email: event.email,
      userId: event.user_id,
      projectId: event.projectId,
      words: event.event === "data_generated" ? event.words : undefined,
      file_size: event.event === "data_generated" ? event.file_size : undefined,
      data_type: event.event === "data_generated" ? event.data_type : undefined,
      $set: {
        email: event.email,
        userId: event.user_id,
        projectId: event.projectId,
        words: event.event === "data_generated" ? event.words : undefined,
        file_size:
          event.event === "data_generated" ? event.file_size : undefined,
        data_type:
          event.event === "data_generated" ? event.data_type : undefined,
      },
    },
  }));

  const chunks = chunkArray(transformedEvents, CHUNK_SIZE);

  console.log(
    `🚀 Starting upload of ${transformedEvents.length} events in ${chunks.length} chunks...`
  );

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      api_key: "phc_yspKR4pBYiKGGZURu5teTlhau3yUDEHEKiRgnEA2GWQ",
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

// ── Main Execution ───────────────────────────────────────────
async function main(): Promise<void> {
  console.log("🎯 Generating Analytics Data...\n");

  try {
    // Generate users for each month
    for (const monthData of MONTHS_PLAN) {
      generateUsersForMonth(monthData);
    }

    // Generate data events for each month
    for (const monthData of MONTHS_PLAN) {
      generateDataEventsForMonth(monthData);
    }

    // Calculate event type breakdown
    const dataGeneratedEvents = allEvents.filter(
      (e) => e.event === "data_generated"
    ) as DataEvent[];
    const jobFailedEvents = allEvents.filter((e) => e.event === "job_failed");
    const dataDownloadEvents = allEvents.filter(
      (e) => e.event === "data_downloaded"
    );

    // Calculate totals
    const totalWords = dataGeneratedEvents.reduce(
      (sum, event) => sum + event.words,
      0
    );
    const totalFileSize = dataGeneratedEvents.reduce(
      (sum, event) => sum + event.file_size,
      0
    );
    const totalFileSizeGB = totalFileSize / 1024;
    const totalWordsInMillions = totalWords / 1000000;

    // Display summary
    console.log("📊 Generation Summary:");
    console.log("=====================");
    console.log(`👥 Total Users: ${allUsers.length}`);
    console.log(`📁 Total Events: ${allEvents.length.toLocaleString()}`);
    console.log(
      `   📊 Data Generated: ${dataGeneratedEvents.length.toLocaleString()}`
    );
    console.log(
      `   ❌ Jobs Failed: ${jobFailedEvents.length.toLocaleString()}`
    );
    console.log(
      `   ⬇️ Data Downloads: ${dataDownloadEvents.length.toLocaleString()}`
    );
    console.log(
      `📈 Total Data: ${totalFileSizeGB.toFixed(
        2
      )} GB (${totalWordsInMillions.toFixed(1)}M words)`
    );

    // Monthly breakdown
    console.log("\n📅 Monthly Breakdown:");
    console.log("Month    | Data Gen | Downloads | Failures | Total GB");
    console.log("---------|----------|-----------|----------|----------");

    for (const monthData of MONTHS_PLAN) {
      const [monthStart, monthEnd] = getMonthRange(monthData.month);
      const monthEvents = allEvents.filter((event) => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= monthStart && eventDate <= monthEnd;
      });

      const monthDataEvents = monthEvents.filter(
        (e) => e.event === "data_generated"
      ) as DataEvent[];
      const monthJobFailures = monthEvents.filter(
        (e) => e.event === "job_failed"
      );
      const monthDownloads = monthEvents.filter(
        (e) => e.event === "data_downloaded"
      );

      const monthFileSize = monthDataEvents.reduce(
        (sum, event) => sum + event.file_size,
        0
      );
      const monthFileSizeGB = monthFileSize / 1024;

      console.log(
        `${monthData.month} | ${monthDataEvents.length
          .toString()
          .padStart(8)} | ${monthDownloads.length
          .toString()
          .padStart(9)} | ${monthJobFailures.length
          .toString()
          .padStart(8)} | ${monthFileSizeGB.toFixed(2).padStart(8)}`
      );
    }

    // Save to JSON file
    saveDataToFile();

    console.log("\n✅ Data generation completed successfully!");
    console.log("� Data saved to data-generated.json");
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
  uploadInChunks();
}

export { main as generateDataEvents };
