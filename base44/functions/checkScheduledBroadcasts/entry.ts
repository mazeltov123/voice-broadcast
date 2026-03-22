import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow service-role calls from automation (no user auth required)
  const now = new Date().toISOString();

  const scheduledBroadcasts = await base44.asServiceRole.entities.Broadcast.filter({ status: 'scheduled' });

  const due = scheduledBroadcasts.filter(b => b.scheduled_at && b.scheduled_at <= now);

  if (due.length === 0) {
    return Response.json({ triggered: 0 });
  }

  let triggered = 0;
  for (const broadcast of due) {
    // Mark as in_progress first
    await base44.asServiceRole.entities.Broadcast.update(broadcast.id, { status: 'in_progress' });

    // Fire the broadcast notification (same as immediate send)
    await base44.asServiceRole.functions.invoke('sendBroadcastNotification', {
      broadcastId: broadcast.id,
      broadcastName: broadcast.name,
      targetGroups: broadcast.target_groups || [],
      targetContactIds: broadcast.target_contact_ids || [],
    });

    triggered++;
  }

  return Response.json({ triggered, broadcast_ids: due.map(b => b.id) });
});