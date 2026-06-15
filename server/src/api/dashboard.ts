import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne } from '../db/query.js';

const router: RouterType = Router();

router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;

  const pendingClients  = queryOne("SELECT COUNT(DISTINCT client_id) as count FROM messages WHERE user_id = ? AND status = 'pending' AND category != 'spam' AND client_id IS NOT NULL", [userId]) as any;
  const newMessages     = queryOne("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND status = 'pending' AND category != 'spam'", [userId]) as any;
  const urgentCount     = queryOne("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND category = 'urgent' AND status = 'pending'", [userId]) as any;
  const activeProjects  = queryOne("SELECT COUNT(*) as count FROM clients WHERE user_id = ? AND stage IN ('booked','shooting','production')", [userId]) as any;

  // Pipeline breakdown
  const pipelineRows = queryAll("SELECT stage, COUNT(*) as count FROM clients WHERE user_id = ? AND status != 'archived' GROUP BY stage", [userId]) as any[];
  const pipeline: Record<string, number> = { inquiry: 0, engaged: 0, booked: 0, shooting: 0, production: 0, delivered: 0 };
  for (const row of pipelineRows) { pipeline[row.stage] = row.count; }

  // Recent client activity (last 8 clients with non-spam messages)
  const recentActivity = queryAll(`
    SELECT c.id as client_id, c.name as client_name, c.stage,
      (SELECT subject FROM messages m WHERE m.client_id = c.id AND m.category != 'spam' ORDER BY m.created_at DESC LIMIT 1) as last_subject,
      (SELECT MAX(created_at) FROM messages WHERE client_id = c.id AND category != 'spam') as last_message_at,
      (SELECT COUNT(*) FROM messages WHERE client_id = c.id AND status = 'pending' AND category != 'spam') as pending
    FROM clients c
    WHERE c.user_id = ? AND c.status != 'archived'
      AND EXISTS (SELECT 1 FROM messages WHERE client_id = c.id AND category != 'spam')
    ORDER BY last_message_at DESC
    LIMIT 8
  `, [userId]);

  // Revenue this month (from paid invoices)
  const revenueRow = queryOne(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices WHERE user_id = ? AND status = 'paid'
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `, [userId]) as any;

  res.json({
    stats: {
      pendingClients: pendingClients?.count || 0,
      newMessages: newMessages?.count || 0,
      urgentCount: urgentCount?.count || 0,
      activeProjects: activeProjects?.count || 0,
      revenueThisMonth: revenueRow?.total || 0,
    },
    pipeline,
    recentActivity,
  });
});

export { router as dashboardRoutes };
