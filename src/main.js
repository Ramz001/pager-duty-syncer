import { createPagerDutyEvent } from "./utils/createPagerDutyEvent.js";
import {
  CMS_AUTH_COOKIE,
  CMS_URL,
  MAX_TICKETS_FROM_CMS,
} from "./constants/global.constants.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let quickSyncInterval;
let fullSyncInterval;
let isShuttingDown = false;
let isSyncing = false;

async function syncOpenTickets(limit = MAX_TICKETS_FROM_CMS) {
  if (isShuttingDown || isSyncing) return;
  isSyncing = true;

  try {
    console.log(`Fetching up to ${limit} open tickets from CMS...`);
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
      console.log("Finished syncing tickets.");
    }
  } catch (err) {
    console.error(
      "Error during sync:",
      err instanceof Error ? err.message : err,
    );
  } finally {
    isSyncing = false;
  }
}

async function startSyncers() {
  // Run full sync immediately on startup
  await syncOpenTickets(MAX_TICKETS_FROM_CMS);

  const ONE_MINUTE = 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  // Fast sync: 20 latest tickets every 1 minute
  quickSyncInterval = setInterval(() => {
    console.log("Starting quick sync...");
    syncOpenTickets(20);
  }, ONE_MINUTE);

  // Full sync: all tickets every 2 hours
  fullSyncInterval = setInterval(() => {
    console.log("Starting full sync...");
    syncOpenTickets(MAX_TICKETS_FROM_CMS);
  }, TWO_HOURS);
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
