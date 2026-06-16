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

  // Smart recent activity: clients active in last 30 days, with context
  const recentActivity = queryAll(`
    SELECT
      c.id as client_id, c.name as client_name, c.stage, c.type,
      c.updated_at as client_updated_at,
      (SELECT COUNT(*) FROM messages WHERE client_id = c.id AND status = 'pending' AND category != 'spam') as pending,
      (SELECT COUNT(*) FROM proposals WHERE client_id = c.id AND status = 'sent') as pending_proposals,
      (SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND status = 'sent') as unpaid_invoices,
      (SELECT subject FROM messages WHERE client_id = c.id AND category != 'spam' ORDER BY created_at DESC LIMIT 1) as last_subject,
      (SELECT MAX(created_at) FROM messages WHERE client_id = c.id AND category != 'spam') as last_message_at,
      (SELECT status FROM messages WHERE client_id = c.id AND category != 'spam' ORDER BY created_at DESC LIMIT 1) as last_msg_status
    FROM clients c
    WHERE c.user_id = ? AND c.status != 'archived'
      AND c.updated_at >= datetime('now', '-30 days')
      AND EXISTS (SELECT 1 FROM messages WHERE client_id = c.id AND category != 'spam')
    ORDER BY
      CASE WHEN pending > 0 THEN 0 ELSE 1 END,
      last_message_at DESC
    LIMIT 8
  `, [userId]);

  // Map activity to clear action hints
  const enriched = (recentActivity as any[]).map((item: any) => ({
    ...item,
    needsAction: item.pending > 0,
    actionLabel: item.pending > 0 ? 'needs_reply'
      : item.pending_proposals > 0 ? 'proposal_pending'
      : item.unpaid_invoices > 0 ? 'payment_due'
      : 'recently_active',
  }));

  // Revenue this month
  const revenueRow = queryOne(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices WHERE user_id = ? AND status = 'paid'
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `, [userId]) as any;

  // Recent insights (extracted key info from client messages — last 10)
  const recentInsights = queryAll(`
    SELECT ci.type, ci.value, ci.raw_text, ci.created_at,
           c.id as client_id, c.name as client_name
    FROM client_insights ci
    LEFT JOIN clients c ON ci.client_id = c.id
    WHERE ci.user_id = ?
    ORDER BY ci.created_at DESC
    LIMIT 10
  `, [userId]);

  res.json({
    stats: {
      pendingClients: pendingClients?.count || 0,
      newMessages: newMessages?.count || 0,
      urgentCount: urgentCount?.count || 0,
      activeProjects: activeProjects?.count || 0,
      revenueThisMonth: revenueRow?.total || 0,
    },
    pipeline,
    recentActivity: enriched,
    insights: recentInsights,
  });
});

// Analytics — revenue trends, conversion rates, seasonal breakdown
router.get('/analytics', async (req, res) => {
  await initDb();
  const userId = req.userId!;

  // Monthly revenue (last 12 months)
  const monthlyRevenue = queryAll(`
    SELECT strftime('%Y-%m', created_at) as month, SUM(amount) as total, COUNT(*) as count
    FROM invoices WHERE user_id = ? AND status = 'paid'
    AND created_at >= datetime('now', '-12 months')
    GROUP BY month ORDER BY month
  `, [userId]) as any[];

  // Client conversion: inquiry → booked rate
  const totalInquiries = (queryOne("SELECT COUNT(*) as c FROM clients WHERE user_id = ? AND status != 'archived'", [userId]) as any)?.c || 0;
  const totalBooked = (queryOne("SELECT COUNT(*) as c FROM clients WHERE user_id = ? AND stage IN ('booked','shooting','production','delivered')", [userId]) as any)?.c || 0;
  const conversionRate = totalInquiries > 0 ? Math.round((totalBooked / totalInquiries) * 100) : 0;

  // Top service types
  const serviceBreakdown = queryAll(`
    SELECT type, COUNT(*) as count FROM clients WHERE user_id = ? AND type != '' AND status != 'archived'
    GROUP BY type ORDER BY count DESC
  `, [userId]) as any[];

  // Average response time (messages: received → replied)
  const avgResponse = queryOne(`
    SELECT AVG(
      (julianday((SELECT MIN(created_at) FROM messages WHERE client_id = m.client_id AND status = 'replied')) -
       julianday(m.created_at)) * 24
    ) as hours
    FROM messages m WHERE m.user_id = ? AND m.status = 'replied'
  `, [userId]) as any;

  // Monthly message volume
  const messageVolume = queryAll(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM messages WHERE user_id = ? AND category != 'spam'
    AND created_at >= datetime('now', '-6 months')
    GROUP BY month ORDER BY month
  `, [userId]) as any[];

  res.json({
    monthlyRevenue,
    conversion: { totalInquiries, totalBooked, rate: conversionRate },
    serviceBreakdown,
    avgResponseHours: avgResponse?.hours ? Math.round(avgResponse.hours * 10) / 10 : null,
    messageVolume,
  });
});

export { router as dashboardRoutes };
