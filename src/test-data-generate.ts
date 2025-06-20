#!/usr/bin/env bun

/**
 * test-data-generate.ts
 * Comprehensive analysis script for the generated analytics data
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
  file_size: number;
  words: number;
  email: string;
  timestamp: string;
  user_id?: string;
  projectId: string;
}

type AllEvents = DataEvent | JobFailedEvent | DataDownloadEvent;

interface DetailedMonthlyStats {
  month: string;
  dataGenerated: {
    count: number;
    totalWords: number;
    totalFileSize: number;
    avgWordsPerEvent: number;
    avgFileSizePerEvent: number;
    uniqueUsers: Set<string>;
    uniqueProjects: Set<string>;
  };
  jobsFailed: {
    count: number;
    uniqueUsers: Set<string>;
    errorCodes: Map<string, number>;
    errorMessages: Map<string, number>;
  };
  dataDownloads: {
    count: number;
    totalFileSize: number;
    totalWords: number;
    avgFileSizePerDownload: number;
    avgWordsPerDownload: number;
    uniqueUsers: Set<string>;
  };
  userActivity: {
    totalActiveUsers: Set<string>;
    usersWhoGenerated: Set<string>;
    usersWhoDownloaded: Set<string>;
    usersWithFailures: Set<string>;
    avgEventsPerUser: number;
  };
}

function analyzeAllEvents(data: AllEvents[]): {
  [month: string]: DetailedMonthlyStats;
} {
  const monthlyStats: { [month: string]: DetailedMonthlyStats } = {};

  // Initialize monthly stats
  data.forEach((event) => {
    const month = event.timestamp.slice(0, 7); // YYYY-MM
    if (!monthlyStats[month]) {
      monthlyStats[month] = {
        month,
        dataGenerated: {
          count: 0,
          totalWords: 0,
          totalFileSize: 0,
          avgWordsPerEvent: 0,
          avgFileSizePerEvent: 0,
          uniqueUsers: new Set(),
          uniqueProjects: new Set(),
        },
        jobsFailed: {
          count: 0,
          uniqueUsers: new Set(),
          errorCodes: new Map(),
          errorMessages: new Map(),
        },
        dataDownloads: {
          count: 0,
          totalFileSize: 0,
          totalWords: 0,
          avgFileSizePerDownload: 0,
          avgWordsPerDownload: 0,
          uniqueUsers: new Set(),
        },
        userActivity: {
          totalActiveUsers: new Set(),
          usersWhoGenerated: new Set(),
          usersWhoDownloaded: new Set(),
          usersWithFailures: new Set(),
          avgEventsPerUser: 0,
        },
      };
    }
  });

  // Analyze each event
  data.forEach((event) => {
    const month = event.timestamp.slice(0, 7);
    const stats = monthlyStats[month];

    // Track overall user activity
    if (event.user_id) {
      stats.userActivity.totalActiveUsers.add(event.user_id);
    }

    switch (event.event) {
      case "data_generated":
        const dataEvent = event as DataEvent;
        stats.dataGenerated.count++;
        stats.dataGenerated.totalWords += dataEvent.words;
        stats.dataGenerated.totalFileSize += dataEvent.file_size;
        if (dataEvent.user_id) {
          stats.dataGenerated.uniqueUsers.add(dataEvent.user_id);
          stats.userActivity.usersWhoGenerated.add(dataEvent.user_id);
        }
        stats.dataGenerated.uniqueProjects.add(dataEvent.projectId);
        break;

      case "job_failed":
        const failEvent = event as JobFailedEvent;
        stats.jobsFailed.count++;
        if (failEvent.user_id) {
          stats.jobsFailed.uniqueUsers.add(failEvent.user_id);
          stats.userActivity.usersWithFailures.add(failEvent.user_id);
        }

        // Track error codes and messages
        const currentErrorCodeCount =
          stats.jobsFailed.errorCodes.get(failEvent.error_code) || 0;
        stats.jobsFailed.errorCodes.set(
          failEvent.error_code,
          currentErrorCodeCount + 1
        );

        const currentErrorMsgCount =
          stats.jobsFailed.errorMessages.get(failEvent.error_message) || 0;
        stats.jobsFailed.errorMessages.set(
          failEvent.error_message,
          currentErrorMsgCount + 1
        );
        break;

      case "data_downloaded":
        const downloadEvent = event as DataDownloadEvent;
        stats.dataDownloads.count++;
        stats.dataDownloads.totalFileSize += downloadEvent.file_size;
        stats.dataDownloads.totalWords += downloadEvent.words;
        if (downloadEvent.user_id) {
          stats.dataDownloads.uniqueUsers.add(downloadEvent.user_id);
          stats.userActivity.usersWhoDownloaded.add(downloadEvent.user_id);
        }
        break;
    }
  });

  // Calculate averages and derived metrics
  Object.values(monthlyStats).forEach((stats) => {
    // Data generation averages
    if (stats.dataGenerated.count > 0) {
      stats.dataGenerated.avgWordsPerEvent = Math.round(
        stats.dataGenerated.totalWords / stats.dataGenerated.count
      );
      stats.dataGenerated.avgFileSizePerEvent =
        stats.dataGenerated.totalFileSize / stats.dataGenerated.count;
    }

    // Download averages
    if (stats.dataDownloads.count > 0) {
      stats.dataDownloads.avgFileSizePerDownload =
        stats.dataDownloads.totalFileSize / stats.dataDownloads.count;
      stats.dataDownloads.avgWordsPerDownload = Math.round(
        stats.dataDownloads.totalWords / stats.dataDownloads.count
      );
    }

    // User activity averages
    const totalEvents =
      stats.dataGenerated.count +
      stats.jobsFailed.count +
      stats.dataDownloads.count;
    if (stats.userActivity.totalActiveUsers.size > 0) {
      stats.userActivity.avgEventsPerUser =
        totalEvents / stats.userActivity.totalActiveUsers.size;
    }
  });

  return monthlyStats;
}

function displayDetailedAnalysis(monthlyStats: {
  [month: string]: DetailedMonthlyStats;
}) {
  console.log("📊 Comprehensive Analytics Data Analysis");
  console.log("========================================\n");

  const months = Object.keys(monthlyStats).sort();

  // Monthly breakdown
  months.forEach((month) => {
    const stats = monthlyStats[month];

    console.log(`📅 ${month} - Monthly Analysis:`);
    console.log("================================");

    // Data Generation Stats
    console.log("📈 Data Generation:");
    console.log(`   Events: ${stats.dataGenerated.count.toLocaleString()}`);
    console.log(
      `   Total Words: ${stats.dataGenerated.totalWords.toLocaleString()}`
    );
    console.log(
      `   Total File Size: ${stats.dataGenerated.totalFileSize.toFixed(
        2
      )} MB (${(stats.dataGenerated.totalFileSize / 1024).toFixed(2)} GB)`
    );
    console.log(
      `   Avg Words/Event: ${stats.dataGenerated.avgWordsPerEvent.toLocaleString()}`
    );
    console.log(
      `   Avg File Size: ${stats.dataGenerated.avgFileSizePerEvent.toFixed(
        2
      )} MB`
    );
    console.log(`   Unique Users: ${stats.dataGenerated.uniqueUsers.size}`);
    console.log(
      `   Unique Projects: ${stats.dataGenerated.uniqueProjects.size}`
    );

    // Job Failures Stats
    console.log("\n❌ Job Failures:");
    console.log(`   Failed Jobs: ${stats.jobsFailed.count.toLocaleString()}`);
    console.log(
      `   Unique Users Affected: ${stats.jobsFailed.uniqueUsers.size}`
    );

    if (stats.dataGenerated.count > 0) {
      console.log(
        `   Failure Rate: ${(
          (stats.jobsFailed.count / stats.dataGenerated.count) *
          100
        ).toFixed(2)}%`
      );
    } else {
      console.log(`   Failure Rate: N/A (no data generation events)`);
    }

    if (stats.jobsFailed.errorCodes.size > 0) {
      console.log("   Top Error Codes:");
      const sortedErrorCodes = Array.from(stats.jobsFailed.errorCodes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      sortedErrorCodes.forEach(([code, count]) => {
        console.log(`     • ${code}: ${count} occurrences`);
      });
    }

    // Downloads Stats
    console.log("\n⬇️ Data Downloads:");
    console.log(`   Downloads: ${stats.dataDownloads.count.toLocaleString()}`);
    console.log(
      `   Total Downloaded: ${stats.dataDownloads.totalFileSize.toFixed(
        2
      )} MB (${(stats.dataDownloads.totalFileSize / 1024).toFixed(2)} GB)`
    );
    console.log(
      `   Total Words Downloaded: ${stats.dataDownloads.totalWords.toLocaleString()}`
    );

    if (stats.dataDownloads.count > 0) {
      console.log(
        `   Avg Download Size: ${stats.dataDownloads.avgFileSizePerDownload.toFixed(
          2
        )} MB`
      );
      console.log(
        `   Avg Words Per Download: ${stats.dataDownloads.avgWordsPerDownload.toLocaleString()}`
      );
    }

    if (stats.dataGenerated.count > 0) {
      console.log(
        `   Download Rate: ${(
          (stats.dataDownloads.count / stats.dataGenerated.count) *
          100
        ).toFixed(1)}%`
      );
    } else {
      console.log(`   Download Rate: N/A (no data generation events)`);
    }

    // User Activity Stats
    console.log("\n👥 User Activity:");
    console.log(
      `   Total Active Users: ${stats.userActivity.totalActiveUsers.size}`
    );
    console.log(
      `   Users Who Generated Data: ${stats.userActivity.usersWhoGenerated.size}`
    );
    console.log(
      `   Users Who Downloaded: ${stats.userActivity.usersWhoDownloaded.size}`
    );
    console.log(
      `   Users With Failures: ${stats.userActivity.usersWithFailures.size}`
    );
    console.log(
      `   Avg Events Per User: ${stats.userActivity.avgEventsPerUser.toFixed(
        1
      )}`
    );

    const totalEvents =
      stats.dataGenerated.count +
      stats.jobsFailed.count +
      stats.dataDownloads.count;
    console.log(`   Total Events This Month: ${totalEvents.toLocaleString()}`);

    console.log("\n" + "─".repeat(50) + "\n");
  });

  // Overall Summary
  console.log("🎯 Overall Summary Across All Months:");
  console.log("====================================");

  const totalDataGenerated = months.reduce(
    (sum, month) => sum + monthlyStats[month].dataGenerated.count,
    0
  );
  const totalJobFailures = months.reduce(
    (sum, month) => sum + monthlyStats[month].jobsFailed.count,
    0
  );
  const totalDownloads = months.reduce(
    (sum, month) => sum + monthlyStats[month].dataDownloads.count,
    0
  );
  const totalWords = months.reduce(
    (sum, month) => sum + monthlyStats[month].dataGenerated.totalWords,
    0
  );
  const totalFileSize = months.reduce(
    (sum, month) => sum + monthlyStats[month].dataGenerated.totalFileSize,
    0
  );
  const totalDownloadSize = months.reduce(
    (sum, month) => sum + monthlyStats[month].dataDownloads.totalFileSize,
    0
  );

  const allUsers = new Set<string>();
  const allProjects = new Set<string>();
  const allErrorCodes = new Map<string, number>();

  months.forEach((month) => {
    const stats = monthlyStats[month];
    stats.userActivity.totalActiveUsers.forEach((user) => allUsers.add(user));
    stats.dataGenerated.uniqueProjects.forEach((project) =>
      allProjects.add(project)
    );

    stats.jobsFailed.errorCodes.forEach((count, code) => {
      const currentCount = allErrorCodes.get(code) || 0;
      allErrorCodes.set(code, currentCount + count);
    });
  });

  console.log(
    `📊 Total Events: ${(
      totalDataGenerated +
      totalJobFailures +
      totalDownloads
    ).toLocaleString()}`
  );
  console.log(`   Data Generated: ${totalDataGenerated.toLocaleString()}`);
  console.log(`   Job Failures: ${totalJobFailures.toLocaleString()}`);
  console.log(`   Downloads: ${totalDownloads.toLocaleString()}`);

  console.log(`\n📈 Data Metrics:`);
  console.log(
    `   Total Words Generated: ${totalWords.toLocaleString()} (${(
      totalWords / 1000000
    ).toFixed(1)}M)`
  );
  console.log(
    `   Total Data Generated: ${totalFileSize.toFixed(2)} MB (${(
      totalFileSize / 1024
    ).toFixed(2)} GB)`
  );
  console.log(
    `   Total Downloaded: ${totalDownloadSize.toFixed(2)} MB (${(
      totalDownloadSize / 1024
    ).toFixed(2)} GB)`
  );
  console.log(
    `   Avg File Size: ${(totalFileSize / totalDataGenerated).toFixed(
      2
    )} MB per generation`
  );

  console.log(`\n👥 User & Project Metrics:`);
  console.log(`   Total Unique Users: ${allUsers.size}`);
  console.log(`   Total Unique Projects: ${allProjects.size}`);
  console.log(
    `   Avg Events Per User: ${(
      (totalDataGenerated + totalJobFailures + totalDownloads) /
      allUsers.size
    ).toFixed(1)}`
  );
  console.log(
    `   Avg Projects Per User: ${(allProjects.size / allUsers.size).toFixed(1)}`
  );

  console.log(`\n📊 Conversion Rates:`);
  console.log(
    `   Job Failure Rate: ${(
      (totalJobFailures / totalDataGenerated) *
      100
    ).toFixed(2)}%`
  );
  console.log(
    `   Download Rate: ${((totalDownloads / totalDataGenerated) * 100).toFixed(
      1
    )}%`
  );

  if (allErrorCodes.size > 0) {
    console.log(`\n❌ Most Common Error Codes:`);
    const sortedErrors = Array.from(allErrorCodes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    sortedErrors.forEach(([code, count], index) => {
      console.log(
        `   ${index + 1}. ${code}: ${count} occurrences (${(
          (count / totalJobFailures) *
          100
        ).toFixed(1)}%)`
      );
    });
  }

  // Growth analysis
  if (months.length > 1) {
    console.log(`\n📈 Growth Analysis:`);
    const firstMonth = monthlyStats[months[0]];
    const lastMonth = monthlyStats[months[months.length - 1]];

    const dataGenGrowth =
      ((lastMonth.dataGenerated.count - firstMonth.dataGenerated.count) /
        firstMonth.dataGenerated.count) *
      100;
    const userGrowth =
      ((lastMonth.userActivity.totalActiveUsers.size -
        firstMonth.userActivity.totalActiveUsers.size) /
        firstMonth.userActivity.totalActiveUsers.size) *
      100;

    console.log(
      `   Data Generation Growth: ${dataGenGrowth.toFixed(1)}% (${
        months[0]
      } to ${months[months.length - 1]})`
    );
    console.log(
      `   User Growth: ${userGrowth.toFixed(1)}% (${months[0]} to ${
        months[months.length - 1]
      })`
    );
  }
}

function run() {
  try {
    const filePath = path.join(__dirname, "../data-generated.json");

    if (!fs.existsSync(filePath)) {
      console.error(
        "❌ data-generated.json file not found. Please run the data generation script first."
      );
      return;
    }

    console.log("🔍 Loading analytics data...");
    const raw = fs.readFileSync(filePath, "utf8");
    const data: AllEvents[] = JSON.parse(raw);

    if (data.length === 0) {
      console.log("📭 No events found in data-generated.json");
      return;
    }

    console.log(`📈 Analyzing ${data.length.toLocaleString()} events...\n`);

    // Show event type breakdown
    const dataGenerated = data.filter((e) => e.event === "data_generated");
    const jobsFailed = data.filter((e) => e.event === "job_failed");
    const dataDownloaded = data.filter((e) => e.event === "data_downloaded");

    console.log("🔢 Event Type Breakdown:");
    console.log(`   Data Generated: ${dataGenerated.length.toLocaleString()}`);
    console.log(`   Jobs Failed: ${jobsFailed.length.toLocaleString()}`);
    console.log(
      `   Data Downloaded: ${dataDownloaded.length.toLocaleString()}`
    );
    console.log("\n" + "=".repeat(60) + "\n");

    const monthlyStats = analyzeAllEvents(data);
    displayDetailedAnalysis(monthlyStats);
  } catch (error) {
    console.error("❌ Error analyzing data:", error);
  }
}

run();
