import type { Response } from 'express';

interface SseClient {
  id: string;
  userId: string | null;
  role: 'admin' | 'customer' | 'guest';
  res: Response;
}

const clients = new Map<string, SseClient>();

export function registerSseClient(
  id: string,
  userId: string | null,
  role: 'admin' | 'customer' | 'guest',
  res: Response
): void {
  clients.set(id, { id, userId, role, res });
}

export function removeSseClient(id: string): void {
  clients.delete(id);
}

function sendEvent(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}

export function broadcastPublicEvent(event: string, data: unknown): void {
  for (const client of clients.values()) {
    sendEvent(client.res, event, data);
  }
}

export function notifyAdmins(event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.role === 'admin') {
      sendEvent(client.res, event, data);
    }
  }
}

export function notifyUser(userId: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.userId === userId) {
      sendEvent(client.res, event, data);
    }
  }
}
