export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  return secret;
})();

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
try {
  new URL(corsOrigin.split(',')[0].trim());
} catch {
  throw new Error('CORS_ORIGIN must be a valid URL');
}
export const CORS_ORIGIN = corsOrigin;
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
export const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER !== 'false';
export const STAGE_SLA_DAYS = Number(process.env.STAGE_SLA_DAYS || 15);
export const LOGIN_RATE_MAX = Number(process.env.LOGIN_RATE_MAX || 10);
export const LOGIN_RATE_WINDOW_MINUTES = Number(process.env.LOGIN_RATE_WINDOW_MINUTES || 15);
export const PORT = Number(process.env.PORT) || 5000;