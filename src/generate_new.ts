#!/usr/bin/env bun

/**
 * send_user_events.js
 * -------------------------------------------------------------
 * Reads user events from user-events.json and sends them to PostHog
 * -------------------------------------------------------------
 */

import { PostHog } from "posthog-node";
import dotenv from "dotenv";
dotenv.config({ debug: true });
import axios from "axios";
import { readFileSync } from "fs";
import { join } from "path";

// ── PostHog connection ─────────────────────────────────────────
const API_KEY = process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
if (API_KEY == null || API_KEY.trim() === "") {
  console.error("❌  Set POSTHOG_API_KEY");
  process.exit(1);
}

console.log("🔑 PostHog API Key configured");
console.log(`🌐 PostHog Host: ${HOST}`);

const ph = new PostHog(API_KEY, {
  host: HOST,
  historicalMigration: true,
  flushAt: 50, // send a batch every 50 events
  flushInterval: 5000, // or every 5 seconds
});

// Enable debug mode for better visibility
ph.debug();

// ── Interface for user events ─────────────────────────────────
interface UserEvent {
  email: string;
  userId: string;
  username: string;
  timestamp: string;
  event: string;
  acquisition_source: string;
  country: string;
}

// ── Function to read user events from JSON file ──────────────
function readUserEvents(): UserEvent[] {
  try {
    console.log("📁 Reading user-events.json file...");
    const filePath = join(process.cwd(), "user-events.json");
    console.log(`📂 File path: ${filePath}`);
    const fileContent = readFileSync(filePath, "utf-8");
    console.log(`📄 File size: ${fileContent.length} characters`);
    const events = JSON.parse(fileContent) as UserEvent[];
    console.log(`📊 Total events found: ${events.length}`);

    // For testing, let's process only the first 1000 events
    const limitedEvents = events.slice(0, 1000);
    console.log(`📝 Processing first ${limitedEvents.length} events`);
    return limitedEvents;
  } catch (error) {
    console.error("❌ Error reading user-events.json:", error);
    process.exit(1);
  }
}

// ── Function to convert user events to PostHog format ────────
function convertToPostHogFormat(events: UserEvent[]): any[] {
  console.log("🔄 Converting events to PostHog format...");
  return events.map((event) => ({
    distinct_id: event.userId,
    event: event.event,
    properties: {
      email: event.email,
      username: event.username,
      acquisition_source: event.acquisition_source,
      country: event.country,
      $insert_id: `${event.event}_${event.userId}_${event.timestamp}`,
    },
    timestamp: new Date(event.timestamp),
  }));
}

// ── Function to upload events in chunks ──────────────────────
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadInChunks(events: any[]) {
  const CHUNK_SIZE = 100;
  const chunks = chunkArray(events, CHUNK_SIZE);

  console.log(
    `📊 Uploading ${events.length} events in ${chunks.length} chunks...`
  );

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      api_key: API_KEY,
      historical_migration: true,
      batch: chunks[i],
    };

    try {
      console.log(`🚀 Uploading batch ${i + 1}/${chunks.length}...`);
      await axios.post(`${HOST}/batch/`, payload);
      console.log(
        `✅ Uploaded batch ${i + 1}/${chunks.length} (${
          chunks[i].length
        } events)`
      );
    } catch (error) {
      console.error(
        `❌ Error uploading batch ${i + 1}:`,
        //@ts-ignore
        error.response?.data || error.message
      );
      process.exit(1);
    }
  }
}

// ── Main execution ────────────────────────────────────────────
async function main() {
  console.log("🚀 Starting to process user events...");

  // Read user events from JSON file
  const userEvents = readUserEvents();
  console.log(`📄 Loaded ${userEvents.length} events from user-events.json`);

  // Convert to PostHog format
  const postHogEvents = convertToPostHogFormat(userEvents);
  console.log(`🔄 Converted ${postHogEvents.length} events to PostHog format`);

  // Upload to PostHog
  await uploadInChunks(postHogEvents);

  console.log("🎉 All events uploaded successfully!");
}

// Execute main function
main().catch((error) => {
  console.error("❌ Error in main process:", error);
  process.exit(1);
});
