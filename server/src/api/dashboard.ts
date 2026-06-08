import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne } from '../db/query.js';

const router: RouterType = Router();

router.get('/', async (_req, res) => {
  await initDb();
  const today = new Date().toISOString().split('T')[0];

  const newCount = queryOne("SELECT COUNT(*) as count FROM messages WHERE created_at >= ?", [today]) as any;
  const autoReplied = queryOne("SELECT COUNT(*) as count FROM messages WHERE status = 'replied' AND created_at >= ?", [today]) as any;
  const urgent = queryOne("SELECT COUNT(*) as count FROM messages WHERE category = 'urgent' AND status = 'pending'", []) as any;
  const pendingReview = queryOne("SELECT COUNT(*) as count FROM messages WHERE category = 'normal' AND status = 'pending'", []) as any;
  const invoices = queryOne("SELECT COUNT(*) as count FROM invoices WHERE status = 'draft'", []) as any;

  const clientsByStage = queryAll('SELECT stage, COUNT(*) as count FROM clients GROUP BY stage');

  res.json({
    today: {
      newMessages: newCount?.count || 0,
      autoReplied: autoReplied?.count || 0,
      urgent: urgent?.count || 0,
      pendingReview: pendingReview?.count || 0,
      draftInvoices: invoices?.count || 0,
    },
    clientsByStage,
  });
});

export { router as dashboardRoutes };
