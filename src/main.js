import { createPagerDutyEvent } from "./utils/createPagerDutyEvent.js";
import {
  CMS_AUTH_COOKIE,
  CMS_URL,
  MAX_TICKETS_FROM_CMS,
  QUICK_SYNC_TTL,
  FULL_SYNC_TTL,
} from "./constants/global.constants.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatTime = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

let quickSyncInterval;
let fullSyncInterval;
let isShuttingDown = false;
let isSyncing = false;

async function syncOpenTickets(limit = MAX_TICKETS_FROM_CMS) {
  if (isShuttingDown || isSyncing) return;
  isSyncing = true;
  const startTime = new Date();

  try {
    console.log(
      `[${formatTime(startTime)}] Fetching up to ${limit} open tickets from CMS...`,
    );
    const cmsRes = await fetch(
      `${CMS_URL}/api/tickets?limit=${limit}&status=open`,
      {
        headers: { Cookie: CMS_AUTH_COOKIE },
      },
    );

    if (!cmsRes.ok) {
      throw new Error(`CMS error ${cmsRes.status}`);
    }

    const cmsData = await cmsRes.json();
    const tickets = cmsData.tickets || [];

    // Sort tickets by createdAt (oldest first)
    tickets.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    console.log(
      `Found ${tickets.length} open tickets. Syncing to PagerDuty...`,
    );

    let count = 0;
    for (const ticket of tickets) {
      if (isShuttingDown) break;

      count++;
      console.log(
        `[${count}/${tickets.length}] Syncing ticket ${ticket.id}...`,
      );

      try {
        // Fetch replies for the current ticket
        const repliesRes = await fetch(
          `${CMS_URL}/api/tickets/${ticket.id}/replies`,
          {
            headers: { Cookie: CMS_AUTH_COOKIE },
          },
        );

        if (repliesRes.ok) {
          ticket.replies = await repliesRes.json();
        } else {
          console.warn(`Could not fetch replies for ticket ${ticket.id}`);
          ticket.replies = [];
        }

        await createPagerDutyEvent(ticket);
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error syncing ticket ${ticket.id}:`, err.message);
        }
      }

      // Slight rate limit: 500ms delay between requests
      if (count < tickets.length) {
        await delay(500);
      }
    }

    if (!isShuttingDown) {
      const endTime = new Date();
      console.log(
        `[${formatTime(endTime)}] Finished syncing tickets. Duration: ${endTime.getTime() - startTime.getTime()}ms`,
      );
    }
  } catch (err) {
    const endTime = new Date();
    console.error(
      `[${formatTime(endTime)}] Error during sync`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    isSyncing = false;
  }
}

async function startSyncers() {
  // Run full sync immediately on startup
  await syncOpenTickets(MAX_TICKETS_FROM_CMS);

  // Fast sync: 20 latest tickets every 1 minute
  quickSyncInterval = setInterval(() => {
    console.log("Starting quick sync...");
    syncOpenTickets(20);
  }, QUICK_SYNC_TTL);

  // Full sync: all tickets every 2 hours
  fullSyncInterval = setInterval(() => {
    console.log("Starting full sync...");
    syncOpenTickets(MAX_TICKETS_FROM_CMS);
  }, FULL_SYNC_TTL);
}

async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  isShuttingDown = true;

  if (quickSyncInterval) clearInterval(quickSyncInterval);
  if (fullSyncInterval) clearInterval(fullSyncInterval);

  while (isSyncing) {
    await delay(500);
  }

  console.log("Shutdown complete.");
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startSyncers();
