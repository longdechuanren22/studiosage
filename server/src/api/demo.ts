import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { run, queryOne } from '../db/query.js';
import { getDefaultUserId } from './clients.js';

const router: RouterType = Router();

const DEMO_MESSAGES = [
  {
    from: "sarah.johnson@gmail.com",
    subject: "Re: Wedding photos timeline",
    body: "Hi Emma! We're SO excited to see the photos from our wedding last Saturday! Quick question - can we add 2 more hours of coverage to the package? And do you offer prints? Thanks!",
    category: "normal",
    stage: "post_production",
    aiReply: "Hi Sarah! So happy to hear from you! Yes, you can absolutely add 2 hours — it would be $400 extra. And I do offer prints starting at $25 per 8x10. Want me to send you the print catalog? Your gallery is almost ready — sneak peek coming this week!",
    clientName: "Sarah & Mike",
    clientStage: "post_production",
  },
  {
    from: "david.lee@gmail.com",
    subject: "Gallery access problem - URGENT",
    body: "Emma, I can't access the gallery. The password isn't working and my wedding is literally tomorrow! Please help ASAP!",
    category: "urgent",
    stage: "delivery",
    aiReply: "David, I'm so sorry about this! Let me reset your gallery password right away. Your new password is: SarahMike2024! Here's the direct link: https://pixieset.com/gallery/sarah-mike-wedding. Please try now and let me know if you have any issues. I'm here for you!",
    clientName: "David L.",
    clientStage: "delivery",
  },
  {
    from: "jennifer.wong@gmail.com",
    subject: "Thank you!!!",
    body: "Emma!!! The photos are absolutely STUNNING! I've been crying happy tears all morning. Thank you so much for capturing our day so beautifully. Can we order 3 extra albums for the parents?",
    category: "normal",
    stage: "post_delivery",
    aiReply: "Jennifer, thank you so much! This made my day. I'm thrilled you love them. Yes, absolutely — 3 extra parent albums will be $450 total. I'll get those ordered for you right away. It was such a joy photographing your wedding!",
    clientName: "Jennifer W.",
    clientStage: "post_delivery",
  },
];

router.post('/seed', async (req, res) => {
  await initDb();
  const userId = req.userId || getDefaultUserId();
  for (const msg of DEMO_MESSAGES) {
    const exists = queryOne("SELECT id FROM messages WHERE from_address = ? AND subject = ? AND user_id = ?", [msg.from, msg.subject, userId]);
    if (exists) continue;

    const clientId = randomUUID();
    const existingClient = queryOne("SELECT id FROM clients WHERE email = ? AND user_id = ?", [msg.from, userId]);
    if (!existingClient) {
      run("INSERT INTO clients (id, user_id, email, name, stage) VALUES (?, ?, ?, ?, ?)",
        [clientId, userId, msg.from, msg.clientName, msg.clientStage || 'post_production']);
    }

    const cid = existingClient ? (existingClient as any).id : clientId;

    run("INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, stage_at_time) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      [randomUUID(), userId, cid, msg.from, msg.subject, msg.body, msg.category, msg.aiReply, msg.stage]);
  }
  res.json({ seeded: DEMO_MESSAGES.length, message: "Demo data loaded. Refresh inbox." });
});

export { router as demoRoutes };
