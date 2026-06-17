import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { authenticate } from '../middleware/auth.js';

const router: RouterType = Router();
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || '';        // $19/mo
const STRIPE_PRICE_PRO_ANNUAL = process.env.STRIPE_PRICE_PRO_ANNUAL || ''; // $15/mo billed annually

// ── Plan definitions ──
export const PLANS = {
  trial: { name: 'Free', projects: 1, photos: 500, ai: false, price: 0 },
  pro: { name: 'Pro', projects: Infinity, photos: Infinity, ai: true, price: 19 },
  pro_annual: { name: 'Pro Annual', projects: Infinity, photos: Infinity, ai: true, price: 15 },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanLimit(plan: string, key: 'projects' | 'photos'): number {
  const p = PLANS[plan as PlanKey] || PLANS.trial;
  return p[key] as number;
}

export function planHasAI(plan: string): boolean {
  const p = PLANS[plan as PlanKey] || PLANS.trial;
  return !!p.ai;
}

// ── Create Stripe Checkout session ──
router.post('/create-checkout', authenticate, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { plan } = req.body; // 'pro' | 'pro_annual'

  if (!STRIPE_SECRET) {
    return res.status(500).json({ error: 'Stripe 未配置' });
  }

  const priceId = plan === 'pro_annual' ? STRIPE_PRICE_PRO_ANNUAL : STRIPE_PRICE_PRO;
  if (!priceId) return res.status(400).json({ error: '无效套餐' });

  const user = queryOne('SELECT email, stripe_customer_id FROM users WHERE id = ?', [userId]) as any;
  if (!user) return res.status(404).json({ error: '用户不存在' });

  // Call Stripe API
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    // Create or get customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const custResp = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email: user.email, metadata: JSON.stringify({ userId }) }),
      });
      const cust = await custResp.json() as any;
      if (!custResp.ok) throw new Error(cust.error?.message || '创建客户失败');
      customerId = cust.id;
      run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
    }

    // Create checkout session
    const sessionResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        success_url: `${baseUrl}/sage/settings?checkout=success`,
        cancel_url: `${baseUrl}/sage/settings?checkout=cancelled`,
        'subscription_data[metadata[userId]]': userId,
      }),
    });
    const session = await sessionResp.json() as any;
    if (!sessionResp.ok) throw new Error(session.error?.message || '创建会话失败');

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Stripe Customer Portal (billing management) ──
router.post('/portal', authenticate, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const user = queryOne('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]) as any;
  if (!user?.stripe_customer_id) return res.status(400).json({ error: '未绑定支付方式' });

  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: user.stripe_customer_id,
        return_url: `${baseUrl}/sage/settings`,
      }),
    });
    const session = await resp.json() as any;
    if (!resp.ok) throw new Error(session.error?.message || '创建门户失败');
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get current plan info ──
router.get('/plan', authenticate, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const user = queryOne('SELECT plan, stripe_subscription_id FROM users WHERE id = ?', [userId]) as any;
  if (!user) return res.status(404).json({ error: '用户不存在' });

  // Count active projects
  const projectCount = queryOne(
    "SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status NOT IN ('completed','cancelled')",
    [userId]
  ) as any;

  // Count total photos across all galleries
  const photoCount = queryOne(
    `SELECT COALESCE(SUM(g.total_count), 0) as count
     FROM project_galleries g JOIN projects p ON g.project_id = p.id
     WHERE p.user_id = ?`,
    [userId]
  ) as any;

  const plan = PLANS[user.plan as PlanKey] || PLANS.trial;

  res.json({
    plan: user.plan,
    planName: plan.name,
    limits: { projects: plan.projects, photos: plan.photos },
    usage: { projects: projectCount.count, photos: photoCount.count },
    hasAI: plan.ai,
    stripeSubscriptionId: user.stripe_subscription_id,
  });
});

export { router as billingRoutes };
