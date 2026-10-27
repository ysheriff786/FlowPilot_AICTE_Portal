import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../src/backend/app';

// Single Vercel Node function. `vercel.json` rewrites every /api/* request here
// and Vercel preserves the original URL, so Express sees the same paths it
// serves locally.
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  app(req, res);
}

export const config = {
  maxDuration: 30,
};
