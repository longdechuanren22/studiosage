import type { Request, Response, NextFunction } from 'express';
import { queryOne, queryAll } from '../db/query.js';
import { PLANS, type PlanKey } from '../api/billing.js';

/**
 * Check if user has reached project limit
 * Used before creating a new project
 */
export async function checkProjectLimit(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId!;

  const user = queryOne('SELECT plan FROM users WHERE id = ?', [userId]) as any;
  if (!user) return res.status(401).json({ error: '未登录' });

  const plan = PLANS[user.plan as PlanKey] || PLANS.trial;
  if (plan.projects === Infinity) return next();

  const activeCount = queryOne(
    "SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status NOT IN ('completed','cancelled')",
    [userId]
  ) as any;

  if (activeCount.count >= plan.projects) {
    return res.status(402).json({
      error: `免费版限制 ${plan.projects} 个活跃项目，当前已有 ${activeCount.count} 个`,
      code: 'PLAN_LIMIT',
      limit: plan.projects,
      current: activeCount.count,
      upgradeUrl: '/sage/settings?upgrade=pro',
    });
  }

  next();
}

/**
 * Check AI feature access
 */
export function checkAI(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId!;
  const user = queryOne('SELECT plan FROM users WHERE id = ?', [userId]) as any;
  if (!user) return res.status(401).json({ error: '未登录' });

  const plan = PLANS[user.plan as PlanKey] || PLANS.trial;
  if (!plan.ai) {
    return res.status(402).json({
      error: 'AI 功能需要 Pro 或 Studio 套餐',
      code: 'AI_LIMITED',
      upgradeUrl: '/sage/settings?upgrade=pro',
    });
  }
  next();
}

/**
 * Check photo upload limit
 */
export function checkPhotoLimit(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId!;
  const user = queryOne('SELECT plan FROM users WHERE id = ?', [userId]) as any;
  if (!user) return res.status(401).json({ error: '未登录' });

  const plan = PLANS[user.plan as PlanKey] || PLANS.trial;
  if (plan.photos === Infinity) return next();

  const photoCount = queryOne(
    `SELECT COALESCE(SUM(g.total_count), 0) as count
     FROM project_galleries g JOIN projects p ON g.project_id = p.id
     WHERE p.user_id = ?`,
    [userId]
  ) as any;

  if (photoCount.count >= plan.photos) {
    return res.status(402).json({
      error: `免费版限制 ${plan.photos} 张照片，当前已有 ${photoCount.count} 张`,
      code: 'PHOTO_LIMIT',
      limit: plan.photos,
      current: photoCount.count,
      upgradeUrl: '/sage/settings?upgrade=pro',
    });
  }

  next();
}
