import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { runJobs } from '../jobs/scheduler';

export const runJobsEndpoint = async (_req: AuthRequest, res: Response) => {
  try {
    await runJobs();
    res.json({ message: 'Jobs executed' });
  } catch (error) {
    console.error('runJobsEndpoint error:', error);
    res.status(500).json({ message: 'Failed to run jobs' });
  }
};