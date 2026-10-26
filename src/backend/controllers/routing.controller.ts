import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { recordAudit } from '../lib/audit';

export const getRoutingRules = async (_req: AuthRequest, res: Response) => {
  try {
    const rules = await prisma.routingRule.findMany({ orderBy: [{ category: 'asc' }, { isNew: 'asc' }] });
    res.json(rules);
  } catch (error) {
    console.error('getRoutingRules error:', error);
    res.status(500).json({ message: 'Failed to fetch routing rules' });
  }
};

export const createRoutingRule = async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({ category: z.string().min(2), isNew: z.boolean(), route: z.string().min(2) });
    const data = schema.parse(req.body);
    const rule = await prisma.routingRule.create({ data: { ...data, route: data.route as any } });
    await recordAudit({ actorId: req.user!.id, action: 'ROUTING_RULE_CREATED', entity: 'RoutingRule', entityId: rule.id, metadata: { category: data.category, isNew: data.isNew, route: data.route } });
    res.status(201).json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid data' });
    console.error('createRoutingRule error:', error);
    res.status(500).json({ message: 'Failed to create routing rule' });
  }
};

export const getStateRegions = async (_req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.stateRegion.findMany({ orderBy: { state: 'asc' } });
    res.json(items);
  } catch (error) {
    console.error('getStateRegions error:', error);
    res.status(500).json({ message: 'Failed to fetch state regions' });
  }
};

export const createStateRegion = async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({ state: z.string().min(2), region: z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL']) });
    const data = schema.parse(req.body);
    const item = await prisma.stateRegion.create({ data });
    await recordAudit({ actorId: req.user!.id, action: 'STATE_REGION_CREATED', entity: 'StateRegion', entityId: item.id, metadata: { state: data.state, region: data.region } });
    res.status(201).json(item);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid data' });
    console.error('createStateRegion error:', error);
    res.status(500).json({ message: 'Failed to create state region' });
  }
};