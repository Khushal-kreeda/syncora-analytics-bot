#!/usr/bin/env bun

/**
 * generate_users.js
 * -------------------------------------------------------------
 * Creates 4 493 synthetic users for Jan–Oct 2025
 *   • ~60 % India  • ~30 % US  • ~10 % Europe
 *   • ≤ 3 users per exact (lat,lon)          *
 *   • One “Synthetic Sign-Up” event per user *
 * -------------------------------------------------------------
 */

import { PostHog } from "posthog-node";
import { faker } from "@faker-js/faker";
import UserAgent from "user-agents";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config({ debug: true });
import axios from "axios";

// ── PostHog connection ─────────────────────────────────────────
const API_KEY = process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
if (API_KEY == null || API_KEY.trim() === "") {
  console.error("❌  Set POSTHOG_API_KEY");
  process.exit(1);
}
const ph = new PostHog(API_KEY, {
  host: HOST,
  historicalMigration: true,
  flushAt: 50, // send a batch every 50 events
  flushInterval: 5000, // or every 5 seconds
});

// Enable debug mode for better visibility
ph.debug();

// // ── 1.  Sign-up plan ───────────────────────────────────────────
// const PLAN: Array<[string, number]> = [
//   ["2025-01", 50],
//   ["2025-02", 73],
//   ["2025-03", 106],`
//   ["2025-04", 154],
//   ["2025-05", 10],
//   ["2025-06", 323],
//   ["2025-07", 468],
//   ["2025-08", 680],
//   ["2025-09", 986],
//   ["2025-10", 1430],
// ];

// const PLAN: [string, { signups: number; mau: number; dau: number }][] = [
//   ["2025-01", { signups: 50, mau: 43, dau: 19 }],
//   ["2025-02", { signups: 73, mau: 105, dau: 47 }],
//   ["2025-03", { signups: 106, mau: 195, dau: 88 }],
//   ["2025-04", { signups: 154, mau: 325, dau: 146 }],
//   ["2025-05", { signups: 223, mau: 515, dau: 232 }],
// ];

const PLAN: [string, { signups: number; mau: number; dau: number }][] = [
  ["2025-01", { signups: 1, mau: 1, dau: 1 }],
  //   ["2025-02", { signups: 73, mau: 105, dau: 47 }],
  //   ["2025-03", { signups: 106, mau: 195, dau: 88 }],
  //   ["2025-04", { signups: 154, mau: 325, dau: 146 }],
  //   ["2025-05", { signups: 223, mau: 515, dau: 232 }],
];
const TOTAL = PLAN.reduce((s, [, n]) => s + n.signups, 0); // 4 493

// ── 2.  Region quotas ─────────────────────────────────────────
const quota = {
  IN: Math.round(0.6 * TOTAL), // 60 %
  US: Math.round(0.3 * TOTAL), // 30 %
  EU: TOTAL, // assign remainder below
};
quota.EU = TOTAL - quota.IN - quota.US; // 10 %

// ── 3.  City pools (trim as you like) ─────────────────────────
const IN_CITIES = [
  ["Mumbai", 19.076, 72.8777, "400001", "MH", "Maharashtra"],
  ["Delhi", 28.7041, 77.1025, "110001", "DL", "Delhi"],
  ["Bengaluru", 12.9716, 77.5946, "560001", "KA", "Karnataka"],
  ["Hyderabad", 17.385, 78.4867, "500001", "TG", "Telangana"],
  ["Chennai", 13.0827, 80.2707, "600001", "TN", "Tamil Nadu"],
  ["Kolkata", 22.5726, 88.3639, "700001", "WB", "West Bengal"],
  ["Pune", 18.5204, 73.8567, "411001", "MH", "Maharashtra"],
  ["Ahmedabad", 23.0225, 72.5714, "380001", "GJ", "Gujarat"],
  ["Jaipur", 26.9124, 75.7873, "302001", "RJ", "Rajasthan"],
  ["Lucknow", 26.8467, 80.9462, "226001", "UP", "Uttar Pradesh"],
  ["Indore", 22.7196, 75.8577, "452001", "MP", "Madhya Pradesh"],
  ["Nagpur", 21.1458, 79.0882, "440001", "MH", "Maharashtra"],
  ["Surat", 21.1702, 72.8311, "395003", "GJ", "Gujarat"],
  ["Patna", 25.5941, 85.1376, "800001", "BR", "Bihar"],
  ["Coimbatore", 11.0168, 76.9558, "641001", "TN", "Tamil Nadu"],
  ["Visakhapatnam", 17.6868, 83.2185, "530001", "AP", "Andhra Pradesh"],
  ["Bhopal", 23.2599, 77.4126, "462001", "MP", "Madhya Pradesh"],
  ["Chandigarh", 30.7333, 76.7794, "160001", "CH", "Chandigarh"],
  ["Vijayawada", 16.5062, 80.648, "520001", "AP", "Andhra Pradesh"],
  ["Thiruvananthapuram", 8.5241, 76.9366, "695001", "KL", "Kerala"],
];
const US_CITIES = [
  ["New York", 40.7128, -74.006, "10001", "NY", "New York"],
  ["Los Angeles", 34.0522, -118.2437, "90001", "CA", "California"],
  ["Chicago", 41.8781, -87.6298, "60601", "IL", "Illinois"],
  ["Houston", 29.7604, -95.3698, "77001", "TX", "Texas"],
  ["Phoenix", 33.4484, -112.074, "85001", "AZ", "Arizona"],
  ["Philadelphia", 39.9526, -75.1652, "19019", "PA", "Pennsylvania"],
  ["San Antonio", 29.4241, -98.4936, "78201", "TX", "Texas"],
  ["San Diego", 32.7157, -117.1611, "92101", "CA", "California"],
  ["Dallas", 32.7767, -96.797, "75201", "TX", "Texas"],
  ["San Jose", 37.3382, -121.8863, "95113", "CA", "California"],
];
const EU_CITIES = [
  ["London", 51.5072, -0.1276, "EC1A", "ENG", "England"],
  ["Paris", 48.8566, 2.3522, "75001", "IDF", "Île-de-France"],
  ["Berlin", 52.52, 13.405, "10115", "BE", "Berlin"],
  ["Madrid", 40.4168, -3.7038, "28001", "MD", "Madrid"],
  ["Rome", 41.9028, 12.4964, "00184", "LAZ", "Lazio"],
  ["Amsterdam", 52.3676, 4.9041, "1011", "NH", "North Holland"],
  ["Dublin", 53.3498, -6.2603, "D01", "L", "Leinster"],
  ["Zurich", 47.3769, 8.5417, "8001", "ZH", "Zurich"],
  ["Barcelona", 41.3874, 2.1686, "08001", "CT", "Catalonia"],
  ["Warsaw", 52.2297, 21.0122, "00-001", "MZ", "Masovian"],
];

// ── 4.  Utilities ─────────────────────────────────────────────
const OS_CHOICES = [
  ["Windows", "10"],
  ["macOS", "14"],
  ["Ubuntu", "24.04"],
];
const BROWSER_CHOICES = [
  ["Chrome", 137],
  ["Firefox", 128],
  ["Edge", 136],
];

const dataFinal: any = [];

const geoUsage = new Map(); // lat_lon → count (≤3)
const monthRange = (ym: string): [Date, Date] => {
  // "2025-03" → [Date, Date]
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 8)); // 08:00 UTC ~ 13:30 IST
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // last ms of month
  return [start, end];
};
const randDate = (start: Date, end: Date): Date =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

function pickRegion(): "IN" | "US" | "EU" {
  const totalLeft = quota.IN + quota.US + quota.EU;
  const roll = Math.random() * totalLeft;
  if (roll < quota.IN) {
    quota.IN--;
    return "IN";
  }
  if (roll < quota.IN + quota.US) {
    quota.US--;
    return "US";
  }
  quota.EU--;
  return "EU";
}

function pickCity(region: "IN" | "US" | "EU"): Array<string | number> {
  const pool =
    region === "IN" ? IN_CITIES : region === "US" ? US_CITIES : EU_CITIES;
  return faker.helpers.arrayElement(pool);
}

function uniqueLatLon(baseLat: number, baseLon: number): [number, number] {
  while (true) {
    const lat = +(
      baseLat + faker.number.float({ min: -0.02, max: 0.02 })
    ).toFixed(3);
    const lon = +(
      baseLon + faker.number.float({ min: -0.02, max: 0.02 })
    ).toFixed(3);
    const key = `${lat}_${lon}`;
    if ((geoUsage.get(key) ?? 0) < 3) {
      geoUsage.set(key, (geoUsage.get(key) ?? 0) + 1);
      return [lat, lon];
    }
  }
}

function buildProps(
  cityArr: Array<string | number>,
  region: string,
  timestampISO: string
): Record<string, any> {
  const [city, baseLat, baseLon, postal, subCode, subName] = cityArr;
  const [lat, lon] = uniqueLatLon(baseLat as number, baseLon as number);
  const country =
    region === "IN"
      ? ["IN", "India", "Asia", "AS", "Asia/Kolkata"]
      : region === "US"
      ? ["US", "United States", "North America", "NA", "America/New_York"]
      : ["EU", "Europe", "Europe", "EU", "Europe/Berlin"];
  const [cc, cName, continentName, contCode, tz] = country;
  const [osName, osVer] = faker.helpers.arrayElement(OS_CHOICES);
  const [browser, browserVer] = faker.helpers.arrayElement(BROWSER_CHOICES);
  const initialPath = faker.helpers.arrayElement([
    "/home/dashboard",
    "home/billing",
    "/signup",
  ]);
  const ua = new UserAgent().toString();

  const base = {
    auth_method: "email",
    email: faker.internet.email(),
    username: faker.internet.username(),
    isPaying: faker.datatype.boolean(),
    subscriptionPlan: "Free",
    platform: "kaggle",
    $initial_host: "dev.d2ekwzzeioc4cw.amplifyapp.com",
    "Creator event ID": uuidv4(),
  };

  for (const prefix of ["Initial", "Latest"]) {
    const isFirst = prefix === "Initial";
    const path = isFirst ? initialPath : "/login";
    Object.assign(base, {
      [`${prefix} host`]: "app.syncora.ai",
      [`${prefix} current URL`]: `${process.env.FRONTEND_URL}${path}`,
      [`${prefix} path name`]: path,
      [`${prefix} device type`]: "Desktop",
      [`${prefix} browser`]: browser,
      [`${prefix} browser version`]: String(browserVer),
      [`${prefix} OS`]: osName,
      [`${prefix} OS version`]: osVer,
      [`${prefix} raw user agent`]: ua,
      [`${prefix} screen height`]: 1080,
      [`${prefix} screen width`]: 1920,
      [`${prefix} viewport height`]: faker.number.int({ min: 800, max: 950 }),
      [`${prefix} viewport width`]: 1920,
      [`${prefix} GeoIP detection accuracy radius`]: 200,
      [`${prefix} city name`]: city,
      [`${prefix} latitude`]: lat,
      [`${prefix} longitude`]: lon,
      [`${prefix} postal code`]: postal,
      [`${prefix} country code`]: cc,
      [`${prefix} country name`]: cName,
      [`${prefix} continent code`]: contCode,
      [`${prefix} continent name`]: continentName,
      [`${prefix} subdivision 1 code`]: subCode,
      [`${prefix} subdivision 1 name`]: subName,
      [`${prefix} timezone`]: tz,
      [`${prefix} referrer URL`]: "$direct",
      [`${prefix} referring domain`]: "$direct",
    });
  }

  return base;
}

// ── 5.  Main loop ─────────────────────────────────────────────
async function generateUsers(): Promise<void> {
  const allUsers: { id: string; props: any; signUpDate: Date }[] = [];

  const getDailyUserCount = (target: number): number => {
    const min = Math.floor(target * 0.6); // e.g. 60% of target
    return faker.number.int({ min, max: target });
  };

  for (const [ym, { signups, mau, dau }] of PLAN) {
    const [monthStart, monthEnd] = monthRange(ym);
    const daysInMonth = new Date(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      0
    ).getUTCDate();
    const monthlyActives = new Set<string>();

    // STEP 1: Generate new users
    for (let i = 0; i < signups; i++) {
      const signUpDate = randDate(monthStart, monthEnd);
      const region = pickRegion();
      const city = pickCity(region);
      const props = buildProps(city, region, signUpDate.toISOString());
      const id = uuidv4();

      allUsers.push({ id, signUpDate, props });

      //   ph.capture({
      //     distinct_id: id,
      //     event: "user-sign-up",
      //     properties: { ...props, $insert_id: `signup_${id}` },
      //     timestamp: signUpDate,
      //   });
      dataFinal.push({
        distinct_id: id,
        event: "user-sign-up",
        properties: { ...props, $insert_id: `signup_${id}` },
        timestamp: signUpDate,
      });
    }

    // STEP 2: Daily actives (DAU with variability)
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d)
      );
      const eligible = allUsers.filter((u) => u.signUpDate <= day);
      const count = Math.min(getDailyUserCount(dau), eligible.length);
      const sampled = faker.helpers.arrayElements(eligible, count);

      for (const user of sampled) {
        const ts = randDate(day, new Date(day.getTime() + 12 * 60 * 60 * 1000)); // random time during day
        monthlyActives.add(user.id);

        // ph.capture({
        //   distinct_id: user.id,
        //   event: "user-active",
        //   properties: {
        //     ...user.props,
        //     $insert_id: `active_${user.id}_${ts.toISOString()}`,
        //   },
        //   timestamp: ts,
        // });

        dataFinal.push({
          distinct_id: user.id,
          event: "user-active",
          properties: {
            ...user.props,
            $insert_id: `active_${user.id}_${ts.toISOString()}`,
          },
          timestamp: ts,
        });
      }
    }

    // STEP 3: Fulfill MAU
    if (monthlyActives.size < mau) {
      const eligible = allUsers.filter(
        (u) => u.signUpDate <= monthEnd && !monthlyActives.has(u.id)
      );
      const toAdd = faker.helpers.arrayElements(
        eligible,
        Math.min(mau - monthlyActives.size, eligible.length)
      );

      for (const user of toAdd) {
        const ts = randDate(monthStart, monthEnd);
        monthlyActives.add(user.id);

        // ph.capture({
        //   distinct_id: user.id,
        //   event: "user-active",
        //   properties: {
        //     ...user.props,
        //     $insert_id: `active_${user.id}_${ts.toISOString()}`,
        //   },
        //   timestamp: ts,
        // });

        dataFinal.push({
          distinct_id: user.id,
          event: "user-active",
          properties: {
            ...user.props,
            $insert_id: `active_${user.id}_${ts.toISOString()}`,
          },
          timestamp: ts,
        });
      }
    }

    console.log(
      `[${ym}] Signups: ${signups}, DAU avg: ~${dau}, MAU achieved: ${monthlyActives.size}`
    );
  }
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadInChunks() {
  const CHUNK_SIZE = 100;
  const chunks = chunkArray(dataFinal, CHUNK_SIZE);

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      api_key: "phc_wMx1yE1jiLQvTMmsJqXs3zsfehArJGRkO7eM1CNSkEg",
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
}

generateUsers()
  .then(uploadInChunks)
  .then(() => {
    console.log(JSON.stringify(dataFinal, null, 2));
    console.log("🎉 All batches uploaded successfully!");
  })
  .catch((error) => {
    console.error("❌ Error in process:", error);
    process.exit(1);
  });
