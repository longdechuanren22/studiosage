// Background worker: poll Gmail → classify → auto-draft replies
import { randomUUID } from 'node:crypto';
import { GmailAdapter } from '../adapters/gmail.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb, saveDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
let running = false;
export async function startInboxWatcher(intervalMs = 60000) {
    if (running)
        return;
    running = true;
    console.log(`[InboxWatcher] Polling every ${intervalMs / 1000}s`);
    const poll = async () => {
        try {
            const token = process.env.GOOGLE_ACCESS_TOKEN;
            if (!token)
                return;
            const gmail = new GmailAdapter(token);
            const messages = await gmail.getRecentMessages(5);
            await initDb();
            for (const msg of messages) {
                if (!msg.id)
                    continue;
                const existing = queryOne('SELECT id FROM messages WHERE id = ?', [msg.id]);
                if (existing)
                    continue;
                const full = await gmail.getMessage(msg.id);
                const classification = await classifyMessage(full.body || '', full.subject || '');
                run(`INSERT INTO messages (id, user_id, from_address, subject, body, category, status, ai_reply)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), 'default', full.from || '', full.subject || '', full.body || '',
                    classification.category, 'pending', classification.suggestedReply]);
                saveDb();
            }
        }
        catch (err) {
            console.error('[InboxWatcher]', err.message);
        }
    };
    await poll();
    setInterval(poll, intervalMs);
}
