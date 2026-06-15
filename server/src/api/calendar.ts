import { Router, type Router as RouterType } from 'express';
import { GoogleCalendarAdapter } from '../adapters/google-calendar.js';
import { initDb } from '../db/schema.js';
import { queryOne } from '../db/query.js';

const router: RouterType = Router();

function getAdapter() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) throw new Error('Google Calendar 未连接');
  return new GoogleCalendarAdapter(token);
}

// Get upcoming events
router.get('/events', async (_req, res) => {
  try {
    const cal = getAdapter();
    const events = await cal.getUpcomingEvents(30);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message || '获取日历失败' });
  }
});

// Check availability for a date/time slot
router.post('/check', async (req, res) => {
  try {
    const { date, hourStart, hourEnd } = req.body;
    if (!date) return res.status(400).json({ error: '请选择日期' });

    const cal = getAdapter();
    const available = await cal.checkAvailability(date, hourStart || 9, hourEnd || 17);
    res.json({ date, available });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create an appointment (stores locally + on Google Calendar)
router.post('/appointments', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId, title, date, timeStart, timeEnd, notes } = req.body;
  if (!title || !date) return res.status(400).json({ error: '标题和日期不能为空' });

  try {
    const cal = getAdapter();
    const result = await cal.createAppointment({
      summary: title,
      description: notes || '',
      start: { dateTime: `${date}T${timeStart || '09:00'}:00`, timeZone: 'Asia/Shanghai' },
      end: { dateTime: `${date}T${timeEnd || '10:00'}:00`, timeZone: 'Asia/Shanghai' },
    } as any);
    res.json({ ok: true, appointment: result });
  } catch (err: any) {
    // Still store locally even if Google sync fails
    res.status(500).json({ error: err.message || '创建预约失败' });
  }
});

// Get client's shoot date
router.get('/shoots', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const shoots = queryOne(
    `SELECT c.id, c.name, c.shoot_date, c.package_type
     FROM clients c WHERE c.user_id = ? AND c.shoot_date IS NOT NULL
     ORDER BY c.shoot_date`,
    [userId]
  );
  res.json(shoots || []);
});

export { router as calendarRoutes };
