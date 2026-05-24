import { mapSeverity } from "./mapSeverity.js";
import {
  CMS_URL,
  PAGERDUTY_ROUTING_KEY,
  PAGERDUTY_EVENT_URL,
  IMAGE_BASE_URL,
} from "../constants/global.constants.js";

export async function createPagerDutyEvent(ticket) {
  const messages = [];
  const pdImages = [];

  for (const reply of (ticket.replies || [])) {
    const time = new Date(reply.createdAt).toLocaleString();
    const author = reply.createdBy?.name || "Unknown";
    const attachmentUrls = (reply.attachments || []).map(path => `${IMAGE_BASE_URL}/${path}`);
    
    messages.push({
      time,
      author,
      content: reply.content || "(No text content)",
      ...(attachmentUrls.length > 0 && { attachments: attachmentUrls })
    });

    for (const url of attachmentUrls) {
      pdImages.push({
        src: url,
        href: url,
        alt: `Attachment from ${author}`
      });
    }
  }

  const body = {
    routing_key: PAGERDUTY_ROUTING_KEY,
    event_action: "trigger",
    dedup_key: ticket.id,
    client_url: `${CMS_URL}/tickets/${ticket.id}`,
    images: pdImages,
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
        replyCount: ticket._count?.replies ?? ticket.replies?.length ?? 0,
        url: `${CMS_URL}/tickets/${ticket.id}`,
        messages: messages,
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
