import "dotenv/config";

export const PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY || "";
export const PAGERDUTY_EVENT_URL = "https://events.eu.pagerduty.com/v2/enqueue";
export const CMS_URL = "https://cms.supportarea.online";
export const CMS_AUTH_COOKIE = process.env.CMS_AUTH_COOKIE || "";
export const MAX_TICKETS_FROM_CMS =
  parseInt(process.env.MAX_TICKETS_FROM_CMS) || 100;
export const IMAGE_BASE_URL = "https://sadhklas.xyz";
export const QUICK_SYNC_TTL = 90 * 1000;
export const FULL_SYNC_TTL = 3 * 60 * 60 * 1000;

if (
  !PAGERDUTY_ROUTING_KEY ||
  !CMS_AUTH_COOKIE ||
  typeof PAGERDUTY_ROUTING_KEY !== "string" ||
  typeof CMS_AUTH_COOKIE !== "string"
) {
  console.log(process.env.PAGERDUTY_ROUTING_KEY, process.env.CMS_AUTH_COOKIE);
  throw new Error(
    "Missing required environment variables. Please set PAGERDUTY_ROUTING_KEY and CMS_AUTH_COOKIE.",
  );
}
