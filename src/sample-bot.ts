import puppeteer, { type Browser, type Page } from "puppeteer";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
dotenv.config();

interface User {
  id: string;
  username: string;
  email: string;
  deviceType: "desktop" | "mobile" | "tablet";
  region: "India" | "US" | "Europe";
  timezone: string;
  locale: string;
}

const generateUser = (index: number): User => {
  const random = Math.random();
  let region: "India" | "US" | "Europe";
  let timezone: string;
  let locale: string;

  console.log(`User ${index + 1}: random value = ${random.toFixed(3)}`); // 👈 log random value

  if (random < 0.6) {
    region = "India";
    timezone = "Asia/Kolkata";
    locale = "en-IN";
  } else if (random < 0.9) {
    region = "US";
    timezone = faker.helpers.arrayElement([
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
    ]);
    locale = "en-US";
  } else {
    region = "Europe";
    timezone = faker.helpers.arrayElement([
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Rome",
      "Europe/Madrid",
    ]);
    locale = faker.helpers.arrayElement([
      "en-GB",
      "fr-FR",
      "de-DE",
      "it-IT",
      "es-ES",
    ]);
  }

  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName });
  const username = faker.internet.username({ firstName, lastName });

  const deviceType = faker.helpers.arrayElement([
    "desktop",
    "mobile",
    "tablet",
  ] as const);

  return {
    id: faker.string.uuid(),
    username,
    email,
    deviceType,
    region,
    timezone,
    locale,
  };
};

const getViewport = (deviceType: string): { width: number; height: number } => {
  switch (deviceType) {
    case "mobile":
      return { width: 375, height: 667 };
    case "tablet":
      return { width: 768, height: 1024 };
    default:
      return { width: 1920, height: 1080 };
  }
};

const simulateUserVisit = async (user: User): Promise<void> => {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log(
      `🚀 [${user.deviceType}] Starting session for ${user.username} from ${user.region}`
    );

    // Launch browser with specific settings for unique sessions
    browser = await puppeteer.launch({
      headless: false, // Show browser window for debugging
      defaultViewport: null,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--incognito", // Force incognito mode for unique sessions
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
      ],
    });

    page = await browser.newPage();

    // Clear any existing cookies/storage to ensure fresh session
    await page.deleteCookie(...(await page.cookies()));
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Set viewport for device simulation
    const viewport = getViewport(user.deviceType);
    await page.setViewport(viewport);

    // Set user agent based on device and region
    const getUserAgent = (deviceType: string, region: string): string => {
      const baseAgents = {
        desktop: {
          India:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          US: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Europe:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        mobile: {
          India:
            "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          US: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
          Europe:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
        },
        tablet: {
          India:
            "Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          US: "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
          Europe:
            "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
        },
      };
      return (
        baseAgents[deviceType as keyof typeof baseAgents]?.[
          region as keyof typeof baseAgents.desktop
        ] ?? baseAgents.desktop.US
      );
    };

    await page.setUserAgent(getUserAgent(user.deviceType, user.region));

    const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

    // Inject PostHog before navigating
    await page.evaluateOnNewDocument(
      (posthogKey: string, userData: User) => {
        // @ts-ignore
        // Add PostHog script
        (window as any).posthog = (window as any).posthog ?? [];
        (function () {
          // @ts-ignore
          const script = document.createElement("script");
          script.type = "text/javascript";
          script.async = true;
          script.src = "https://app-static.posthog.com/static/array.js";

          script.onload = () => {
            console.log("PostHog script loaded successfully");
            try {
              // @ts-ignore
              (window as any).posthog.init(posthogKey, {
                api_host: "https://us.posthog.com",
                person_profiles: "identified_only",
                autocapture: true,
                capture_pageview: true,
                debug: true, // Enable debug mode
                loaded: function (posthog: any) {
                  console.log("PostHog initialized successfully");
                  // Identify the user after initialization with more properties
                  posthog.identify(userData.id, {
                    username: userData.username,
                    email: userData.email,
                    user_id: userData.id,
                    device_type: userData.deviceType,
                    region: userData.region,
                    timezone: userData.timezone,
                    locale: userData.locale,
                    simulation: true,
                    session_id: `sim_${userData.id}_${Date.now()}`,
                  });

                  // Also set person properties
                  posthog.people.set({
                    username: userData.username,
                    email: userData.email,
                    device_type: userData.deviceType,
                    region: userData.region,
                    timezone: userData.timezone,
                    locale: userData.locale,
                    is_simulation: true,
                  });
                },
              });
            } catch (error) {
              console.error("PostHog initialization error:", error);
            }
          };
          // @ts-ignore

          script.onerror = (error) => {
            console.error("PostHog script loading error:", error);
          };
          // @ts-ignore

          const firstScript = document.getElementsByTagName("script")[0];
          if (firstScript?.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
            // @ts-ignore
          } else if (document.head) {
            // @ts-ignore
            document.head.appendChild(script);
          }
        })();
      },
      process.env.POSTHOG_PROJECT_KEY ??
        "phc_wMx1yE1jiLQvTMmsJqXs3zsfehArJGRkO7eM1CNSkEg",
      user
    );

    // Navigate to the main page
    console.log(
      `📄 [${user.deviceType}] ${user.username}: Visiting ${baseUrl}`
    );
    await page.goto(baseUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for PostHog to initialize with better timeout handling
    let posthogLoaded = false;
    let attempts = 0;
    const maxAttempts = 15; // Increased attempts

    while (!posthogLoaded && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased wait time
      attempts++;

      // @ts-ignore
      posthogLoaded = await page.evaluate(() => {
        // @ts-ignore

        const ph = (window as any).posthog;
        return (
          typeof ph !== "undefined" &&
          ph !== null &&
          typeof ph.capture === "function" &&
          typeof ph.identify === "function" &&
          typeof ph.people === "object"
        );
      });

      if (posthogLoaded) {
        console.log(
          `✅ [${user.deviceType}] ${user.username}: PostHog loaded successfully after ${attempts} attempts`
        );
        break;
      } else {
        console.log(
          `⏳ [${user.deviceType}] ${user.username}: Waiting for PostHog... (attempt ${attempts}/${maxAttempts})`
        );
      }
    }

    // Check if PostHog loaded successfully
    if (posthogLoaded) {
      // Force identify the user again and capture events
      // @ts-ignore
      await page.evaluate((userData: User) => {
        // @ts-ignore

        const posthog = (window as any).posthog;
        if (typeof posthog !== "undefined" && posthog !== null) {
          // Re-identify with unique session
          posthog.identify(userData.id, {
            username: userData.username,
            email: userData.email,
            user_id: userData.id,
            device_type: userData.deviceType,
            region: userData.region,
            timezone: userData.timezone,
            locale: userData.locale,
            simulation: true,
            session_id: `sim_${userData.id}_${Date.now()}`,
            visit_timestamp: new Date().toISOString(),
          });

          // Manual capture of page view with custom properties
          posthog.capture("$pageview", {
            // @ts-ignore

            $current_url: window.location.href,
            // @ts-ignore

            page_title: document.title,
            simulation: true,
            device_type: userData.deviceType,
            region: userData.region,
            timezone: userData.timezone,
            user_id: userData.id,
          });

          // Capture a custom event to ensure tracking
          posthog.capture("user-active", {
            username: userData.username,
            device_type: userData.deviceType,
            region: userData.region,
            timezone: userData.timezone,
            user_id: userData.id,
            timestamp: new Date().toISOString(),
          });
        }
      }, user);
    } else {
      console.log(
        `⚠️  [${user.deviceType}] ${user.username}: PostHog failed to load after ${maxAttempts} attempts`
      );

      // Debug: Check what's actually available
      // @ts-ignore
      const debugInfo = await page.evaluate(() => {
        // @ts-ignore

        const ph = (window as any).posthog;
        return {
          posthogExists: typeof ph !== "undefined",
          posthogType: typeof ph,
          posthogValue: ph,
          // @ts-ignore

          windowKeys: Object.keys(window).filter((key) =>
            key.includes("posthog")
          ),
          hasPosthogScript:
            // @ts-ignore

            document.querySelector('script[src*="posthog"]') !== null,
          // @ts-ignore

          consoleErrors: (window as any).postHogErrors ?? [],
        };
      });
      console.log("🐛 Debug info:", debugInfo);
    }

    // Simulate user interaction - scroll and wait
    await page.evaluate(() => {
      // @ts-ignore

      window.scrollTo(
        0,
        // @ts-ignore

        Math.min(window.innerHeight, document.body.scrollHeight / 2)
      );
    });

    // Stay on page for random duration
    const stayDuration = faker.number.int({ min: 5000, max: 15000 });
    console.log(
      `⏱️  [${user.deviceType}] ${user.username}: Staying for ${stayDuration}ms`
    );
    await new Promise((resolve) => setTimeout(resolve, stayDuration));

    // Optional: Visit another page
    if (Math.random() > 0.5) {
      try {
        const subPages = [
          "home/dashboard",
          "home/billing",
          "home/synthetic-data",
          "home/data-contribution",
        ];
        const randomPage = faker.helpers.arrayElement(subPages);
        console.log(
          `🔗 [${user.deviceType}] ${user.username}: Navigating to ${randomPage}`
        );

        await page.goto(`${baseUrl}${randomPage}`, {
          waitUntil: "networkidle2",
          timeout: 15000,
        });

        await new Promise((resolve) =>
          setTimeout(resolve, faker.number.int({ min: 3000, max: 8000 }))
        );
      } catch (error) {
        console.log(
          `ℹ️  [${user.deviceType}] ${user.username}: Sub-page navigation failed (expected for demo)`
        );
      }
    }

    console.log(
      `✅ [${user.deviceType}] ${user.username}: Session completed successfully`
    );
  } catch (error) {
    console.error(
      `❌ [${user.deviceType}] ${user.username}: Error during simulation:`,
      error
    );
  } finally {
    try {
      if (page !== null) await page.close();
      if (browser !== null) await browser.close();
    } catch (closeError) {
      console.error(
        `❌ Error closing browser for ${user.username}:`,
        closeError
      );
    }
  }
};

const runSimulation = async (userCount: number = 5): Promise<void> => {
  console.log("🎬 Starting PostHog unique visitors simulation...");
  console.log(`👥 Will simulate ${userCount} unique visitors`);
  console.log(
    `🌐 Target URL: ${process.env.FRONTEND_URL ?? "http://localhost:3000"}`
  );
  console.log(
    `📊 PostHog Key: ${
      (process.env.POSTHOG_PROJECT_KEY?.length ?? 0) > 0
        ? "Configured"
        : "Using default"
    }`
  );

  const users = Array.from({ length: userCount }, (_, i) =>
    generateUser(i + 1)
  );

  console.log("\n📋 Generated users:");
  users.forEach((user, i) => {
    console.log(
      `  ${i + 1}. ${user.username} (${user.email}) - ${user.deviceType} - ${
        user.region
      } (${user.timezone})`
    );
  });

  // Show regional distribution summary
  const regionCounts: Record<string, number> = users.reduce((acc, user) => {
    // @ts-ignore

    const currentCount = acc[user.region] ?? 0;
    // @ts-ignore

    acc[user.region] = currentCount + 1;
    return acc;
  }, {});

  console.log("\n🌍 Regional distribution:");
  Object.entries(regionCounts).forEach(([region, count]) => {
    const percentage = ((count / users.length) * 100).toFixed(1);
    console.log(`  ${region}: ${count} users (${percentage}%)`);
  });

  console.log("\n🚀 Starting browser sessions...\n");

  // Process users sequentially to avoid overwhelming the system
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n--- User ${i + 1}/${users.length} ---`);
    // @ts-ignore

    await simulateUserVisit(user);

    // Wait between users to make it more realistic and avoid rate limiting
    if (i < users.length - 1) {
      const delay = faker.number.int({ min: 5000, max: 10000 }); // Increased delay
      console.log(`⏳ Waiting ${delay}ms before next user...\n`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log("\n🎉 Simulation completed!");
  console.log(
    `📈 ${userCount} unique visitors should now appear in your PostHog dashboard`
  );
  console.log("💡 Check your PostHog dashboard at: https://us.posthog.com/");
};

// Get user count from environment or default to 5
const userCount = parseInt(process.env.SIMULATION_USER_COUNT ?? "5");

// Run the simulation
runSimulation(userCount).catch((error) => {
  console.error("❌ Simulation failed:", error);
  process.exit(1);
});
