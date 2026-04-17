import { Response } from 'express';

export function apiError(res: Response, status: number, message: string, code?: string): void {
  res.status(status).json({ error: message, ...(code && { code }) });
}
