#!/usr/bin/env bun

/**
 * test-data-generate.ts
 * Analysis script for the generated data_generated events
 */

import * as fs from "fs";
import * as path from "path";

interface DataEvent {
  event: "data_generated";
  words: number;
  file_size: number;
  email: string;
  timestamp: string;
  user_id?: string;
  data_type: "jsonl";
  projectId: string;
}

interface MonthlyStats {
  events: number;
  totalWords: number;
  uniqueUsers: Set<string>;
  avgWordsPerEvent: number;
}

function analyzeDataEvents(data: DataEvent[]) {
  const monthlyStats: { [month: string]: MonthlyStats } = {};

  // Group events by month
  data.forEach((event) => {
    const month = event.timestamp.slice(0, 7); // YYYY-MM
    if (!monthlyStats[month]) {
      monthlyStats[month] = {
        events: 0,
        totalWords: 0,
        uniqueUsers: new Set(),
        avgWordsPerEvent: 0,
      };
    }

    monthlyStats[month].events++;
    monthlyStats[month].totalWords += event.words;
    if (event.user_id) {
      monthlyStats[month].uniqueUsers.add(event.user_id);
    }
  });

  // Calculate averages
  Object.keys(monthlyStats).forEach((month) => {
    const stats = monthlyStats[month];
    stats.avgWordsPerEvent = Math.round(stats.totalWords / stats.events);
  });

  return monthlyStats;
}

function displayAnalysis(monthlyStats: { [month: string]: MonthlyStats }) {
  console.log("📊 Data Generation Analysis");
  console.log("===========================\n");

  const months = Object.keys(monthlyStats).sort();

  months.forEach((month) => {
    const stats = monthlyStats[month];
    const dailyAvgEvents = Math.round(stats.events / 31); // Rough daily average
    const dailyAvgPerUser = (
      stats.events /
      stats.uniqueUsers.size /
      31
    ).toFixed(1);

    console.log(`📅 ${month}:`);
    console.log(`   Events: ${stats.events.toLocaleString()}`);
    console.log(`   Total Words: ${stats.totalWords.toLocaleString()}`);
    console.log(`   Unique Users: ${stats.uniqueUsers.size}`);
    console.log(`   Avg Words/Event: ${stats.avgWordsPerEvent}`);
    console.log(`   Daily Avg Events: ${dailyAvgEvents}`);
    console.log(`   Daily Avg/User: ${dailyAvgPerUser}`);
    console.log("");
  });

  // Overall statistics
  const totalEvents: number = Object.values(monthlyStats).reduce(
    (sum: number, stats: MonthlyStats) => sum + stats.events,
    0
  );
  const totalWords: number = Object.values(monthlyStats).reduce(
    (sum: number, stats: MonthlyStats) => sum + stats.totalWords,
    0
  );
  const allUsers = new Set<string>();
  Object.values(monthlyStats).forEach((stats: MonthlyStats) => {
    stats.uniqueUsers.forEach((user: string) => allUsers.add(user));
  });

  console.log("🎯 Overall Summary:");
  console.log(`   Total Events: ${totalEvents.toLocaleString()}`);
  console.log(`   Total Words: ${totalWords.toLocaleString()}`);
  console.log(`   Total Unique Users: ${allUsers.size}`);
  console.log(
    `   Avg File Size: ${((totalWords * 10) / 1024 / 1024).toFixed(4)} MB`
  );
}

function run() {
  try {
    const filePath = path.join(__dirname, "../data-generated.json");

    if (!fs.existsSync(filePath)) {
      console.error(
        "❌ data-events.json file not found. Please run the data generation script first."
      );
      return;
    }

    console.log("🔍 Loading data events...");
    const raw = fs.readFileSync(filePath, "utf8");
    const data: DataEvent[] = JSON.parse(raw);

    if (data.length === 0) {
      console.log("📭 No data events found in data-generated.json");
      return;
    }

    console.log(`📈 Analyzing ${data.length} data events...\n`);
    const monthlyStats = analyzeDataEvents(data);
    displayAnalysis(monthlyStats);
  } catch (error) {
    console.error("❌ Error analyzing data:", error);
  }
}

run();
