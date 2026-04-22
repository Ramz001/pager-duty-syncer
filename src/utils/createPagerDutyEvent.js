import { mapSeverity } from "./mapSeverity.js";
import {
  CMS_URL,
  PAGERDUTY_ROUTING_KEY,
  PAGERDUTY_EVENT_URL,
} from "../constants/global.constants.js";

export async function createPagerDutyEvent(ticket) {
  const body = {
    routing_key: PAGERDUTY_ROUTING_KEY,
    event_action: "trigger",
    dedup_key: ticket.id,
    client_url: `${CMS_URL}/tickets/${ticket.id}`,
    payload: {
      summary: ticket.title,
      source: "cms.supportarea.online",
      severity: mapSeverity(ticket.priority),
      timestamp: ticket.createdAt || new Date().toISOString(),
      component: "support-ticketing",
      group: ticket.group?.name || "default",
      class: "cms-ticket",
      custom_details: {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: new Date(ticket.createdAt).toLocaleString(),
        game: ticket.game,
        gameUser: ticket.gameUser?.trim(),
        provider: ticket.provider,
        createdBy: ticket.createdBy?.name,
        createdByEmail: ticket.createdBy?.email,
        replyCount: ticket._count?.replies ?? 0,
        url: `${CMS_URL}/tickets/${ticket.id}`,
      },
    },
  };

  const res = await fetch(PAGERDUTY_EVENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PagerDuty error ${res.status}: ${errorText}`);
  }

  return await res.json();
}
