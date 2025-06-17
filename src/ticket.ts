import { writeFileSync } from "fs";
import { faker } from "@faker-js/faker";

interface TicketEvent {
  event: "ticket-raised" | "ticket-resolved";
  email: string;
  username: string;
  timestamp: string;
  ticketId: string;
}

// Targets for each month
const targets = [
  { month: "2025-01", ticketsRaised: 1, ticketsResolved: 1 },
  { month: "2025-02", ticketsRaised: 1, ticketsResolved: 1 },
  { month: "2025-03", ticketsRaised: 2, ticketsResolved: 2 },
  { month: "2025-04", ticketsRaised: 2, ticketsResolved: 2 },
  { month: "2025-05", ticketsRaised: 2, ticketsResolved: 2 },
];

// Generate users once
const users = Array.from({ length: 20 }, (_, i) => {
  faker.seed(i + 1000);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    email: faker.internet.email({ firstName, lastName }),
  };
});

function getDaysInMonth(month: string): string[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${year}-${monthIndex.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  });
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createTimestamp(day: string): string {
  const hour = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  return `${day}T${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}:00Z`;
}

const events: TicketEvent[] = [];
const raisedTickets: Array<{
  id: string;
  user: (typeof users)[0];
  timestamp: string;
}> = [];
let ticketCounter = 1;

// Process each month
for (const { month, ticketsRaised, ticketsResolved } of targets) {
  const days = getDaysInMonth(month);

  // Raise tickets
  for (let i = 0; i < ticketsRaised; i++) {
    const user = randomPick(users);
    const timestamp = createTimestamp(randomPick(days));

    faker.seed(ticketCounter * 100);
    const ticketId = `TKT-${faker.string.alphanumeric(8).toUpperCase()}`;

    raisedTickets.push({ id: ticketId, user, timestamp });

    events.push({
      event: "ticket-raised",
      email: user.email,
      username: user.username,
      timestamp,
      ticketId,
    });

    ticketCounter++;
  }

  // Resolve tickets (from any unresolved tickets)
  const unresolvedTickets = raisedTickets.filter(
    (ticket) =>
      !events.some(
        (event) =>
          event.event === "ticket-resolved" && event.ticketId === ticket.id
      )
  );

  const ticketsToResolve = unresolvedTickets
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(ticketsResolved, unresolvedTickets.length));

  for (const ticket of ticketsToResolve) {
    // Resolve after the ticket was raised, within current month
    const raisedDate = new Date(ticket.timestamp);
    const monthStart = new Date(`${month}-01T00:00:00Z`);
    const monthEnd = new Date(
      `${month}-${getDaysInMonth(month).length}T23:59:59Z`
    );

    const resolveStart = raisedDate > monthStart ? raisedDate : monthStart;
    const resolveTime = new Date(
      resolveStart.getTime() +
        Math.random() * (monthEnd.getTime() - resolveStart.getTime())
    );

    events.push({
      event: "ticket-resolved",
      email: ticket.user.email,
      username: ticket.user.username,
      timestamp: resolveTime.toISOString(),
      ticketId: ticket.id,
    });
  }
}

// Sort events chronologically
events.sort(
  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
);

// Write to file
writeFileSync("events.json", JSON.stringify(events, null, 2));

// Summary
const totalRaised = events.filter((e) => e.event === "ticket-raised").length;
const totalResolved = events.filter(
  (e) => e.event === "ticket-resolved"
).length;

console.log(`✅ Generated ${events.length} events`);
console.log(
  `📊 ${totalRaised} tickets raised, ${totalResolved} tickets resolved`
);
console.log(
  `✅ Constraint check: ${totalResolved <= totalRaised ? "PASS" : "FAIL"}`
);

// Show sample events
console.log("\n📝 Sample events:");
events.slice(0, 6).forEach((event) => {
  console.log(
    `${event.event.padEnd(15)} | ${event.ticketId} | ${event.username.padEnd(
      20
    )} | ${event.timestamp.slice(0, 10)}`
  );
});
