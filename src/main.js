import "dotenv/config";
import { createPagerDutyEvent } from "./utils/createPagerDutyEvent.js";
import { CMS_AUTH_COOKIE, CMS_URL, MAX_TICKETS_FROM_CMS } from "./constants/global.constants.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function syncOpenTickets() {
  console.log("Fetching open tickets from CMS...");
  const cmsRes = await fetch(
    `${CMS_URL}/api/tickets?limit=${MAX_TICKETS_FROM_CMS}&status=open`,
    {
      headers: { Cookie: CMS_AUTH_COOKIE },
    },
  );

  if (!cmsRes.ok) {
    throw new Error(`CMS error ${cmsRes.status}`);
  }

  const cmsData = await cmsRes.json();
  const tickets = cmsData.tickets || [];

  console.log(`Found ${tickets.length} open tickets. Syncing to PagerDuty...`);

  let count = 0;
  for (const ticket of tickets) {
    count++;
    console.log(`[${count}/${tickets.length}] Syncing ticket ${ticket.id}...`);

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

  console.log("Finished syncing tickets.");
}

syncOpenTickets().catch(console.error);

export {};
