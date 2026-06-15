// Simple event bus for SSE push notifications
import { type Response } from 'express';

type EventType = 'message:new' | 'message:replied' | 'invoice:updated' | 'client:updated';

interface Client {
  userId: string;
  res: Response;
}

const clients = new Map<string, Client[]>();

export function subscribe(userId: string, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, []);
  clients.get(userId)!.push({ userId, res });

  // Send initial keepalive
  res.write(':ok\n\n');

  // Cleanup on close
  res.on('close', () => {
    const list = clients.get(userId);
    if (list) {
      const idx = list.findIndex(c => c.res === res);
      if (idx >= 0) list.splice(idx, 1);
      if (list.length === 0) clients.delete(userId);
    }
  });
}

export function publish(userId: string, type: EventType, data: any): void {
  const list = clients.get(userId);
  if (!list) return;
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of list) {
    try { client.res.write(payload); } catch { /* client disconnected */ }
  }
}

// Broadcast to all connected clients of a user
export function notifyMessage(userId: string, message: any): void {
  publish(userId, 'message:new', {
    id: message.id,
    from: message.from_address,
    subject: message.subject,
    clientId: message.client_id,
    category: message.category,
    status: message.status,
  });
}

export function notifyMessageReplied(userId: string, messageId: string): void {
  publish(userId, 'message:replied', { id: messageId });
}

export function notifyInvoiceUpdated(userId: string, invoice: any): void {
  publish(userId, 'invoice:updated', {
    id: invoice.id,
    status: invoice.status,
    amount: invoice.amount,
    clientName: invoice.client_name,
  });
}

export function notifyClientUpdated(userId: string, clientId: string, stage: string): void {
  publish(userId, 'client:updated', { id: clientId, stage });
}
