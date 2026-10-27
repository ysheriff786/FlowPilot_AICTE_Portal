import 'dotenv/config';
import { app, prisma } from './app';
import { startScheduler } from './jobs/scheduler';
import { ENABLE_SCHEDULER } from './lib/config';

const PORT = Number(process.env.PORT) || 5000;

// Importing the app (tests, serverless functions) must not bind a port.
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`FlowPilot API running on http://localhost:${PORT}`);
    if (ENABLE_SCHEDULER) startScheduler();
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { app, prisma };
