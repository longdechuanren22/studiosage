// 事件驱动通知引擎 — 自动起草 + 人工确认发送
// 每个项目事件触发 → AI起草邮件 → 推送到Dashboard → 摄影师点发送 → SMTP发出

import { callAI } from '../ai/engine.js';

export type NotificationType =
  | 'gallery_sent'          // 选片链接已发送 → 通知客户
  | 'selection_reminder'    // 选片截止提醒 → 提醒客户
  | 'selection_overdue'     // 选片逾期 → 警告客户
  | 'delivery_ready'        // 精修完成 → 通知客户审核
  | 'review_reminder'       // 审核截止提醒 → 提醒客户
  | 'delivery_accepted'     // 审核通过 → 感谢+下载链接

interface NotificationContext {
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  details: string;           // 链接、截止日等具体信息
  shareUrl?: string;
  deadline?: string;
  daysLeft?: number;
  roundNumber?: number;
}

export async function draftNotification(
  type: NotificationType,
  ctx: NotificationContext
): Promise<{ subject: string; body: string }> {
  const prompts: Record<NotificationType, string> = {
    gallery_sent: `Write a warm email from a photographer to client "${ctx.clientName}" about their "${ctx.projectTitle}" project.

The proofs gallery is ready. Write:
- A friendly opening
- Selection link: ${ctx.shareUrl || '(见下方)'}
- Selection deadline: ${ctx.deadline || '7 days'}
- How to select photos (click to mark favorites)
- End warmly with photographer's name placeholder [摄影师姓名]

Keep under 120 words. Natural tone.`,

    selection_reminder: `Write a gentle reminder email from a photographer to client "${ctx.clientName}" about their "${ctx.projectTitle}" proofs selection.

- Only ${ctx.daysLeft || 2} days left before the selection deadline
- Remind them to pick their favorites so editing can begin
- This is ${ctx.daysLeft === 1 ? 'the final reminder — deadline is tomorrow' : 'a friendly nudge'}
- End with [摄影师姓名]

Keep under 80 words. Warm but slightly urgent.`,

    selection_overdue: `Write about a missed deadline. The client "${ctx.clientName}" for "${ctx.projectTitle}" has NOT submitted their photo selection and the deadline has passed by ${ctx.daysLeft || 3} days.

- Kindly but firmly ask them to submit today
- Warn that the photographer may need to make selections on their behalf to keep the schedule
- Offer to help if they're having trouble
- End with [摄影师姓名]

Under 100 words. Firm but not aggressive.`,

    delivery_ready: `Write a delivery notification from a photographer to "${ctx.clientName}" for "${ctx.projectTitle}" Round ${ctx.roundNumber || 1}.

The edited photos are ready for review. Write:
- Exciting news — your photos are ready
- Review link: ${ctx.shareUrl || '(见下方)'}
- How to provide feedback (mark specific photos, be specific with revision requests)
- Review deadline: ${ctx.deadline || '3 days'}
- End with [摄影师姓名]

Under 120 words. Enthusiastic tone.`,

    review_reminder: `Write a reminder from a photographer to "${ctx.clientName}" about reviewing their "${ctx.projectTitle}" edited photos.

- ${ctx.daysLeft || 1} day(s) left to review
- Gently remind to provide feedback so the project can move forward
- End with [摄影师姓名]

Under 60 words.`,

    delivery_accepted: `Write a thank-you email from a photographer to "${ctx.clientName}" for "${ctx.projectTitle}".

The client has approved the final photos. Write:
- Thank them warmly
- The download link for all final high-resolution photos: ${ctx.shareUrl || '(见下方)'}
- Any final notes about prints/albums if applicable
- End with [摄影师姓名]

Under 100 words. Grateful and warm.`,
  };

  try {
    const prompt = prompts[type];
    const text = await callAI(prompt, 400, 0.6);
    const lines = text.trim().split('\n').filter(Boolean);

    // First non-empty line is subject, rest is body
    const subject = lines[0]?.replace(/^Subject:\s*/i, '').trim() ||
      type === 'gallery_sent' ? `Your proofs for ${ctx.projectTitle} are ready!` :
      type === 'delivery_ready' ? `Your edited photos for ${ctx.projectTitle} — Round ${ctx.roundNumber || 1}` :
      type === 'delivery_accepted' ? `Thank you — ${ctx.projectTitle}` :
      type === 'selection_reminder' ? `Gentle reminder: ${ctx.projectTitle} proofs selection` :
      type === 'review_reminder' ? `Quick reminder: ${ctx.projectTitle} photo review` :
      type === 'selection_overdue' ? `Action needed: ${ctx.projectTitle} selection overdue` :
      `${ctx.projectTitle} — update`;

    const body = lines.length > 1 ? lines.slice(1).join('\n') : lines.join('\n');

    return { subject: subject.slice(0, 120), body: body.slice(0, 2000) };
  } catch {
    // Fallback templates
    const templates: Record<NotificationType, { subject: string; body: string }> = {
      gallery_sent: {
        subject: `Your proofs for ${ctx.projectTitle} are ready!`,
        body: `Hi ${ctx.clientName},\n\nYour photo proofs for ${ctx.projectTitle} are ready for selection!\n\nSelection link: ${ctx.shareUrl}\nDeadline: ${ctx.deadline || '7 days'}\n\nSimply click the link, browse your photos, and mark your favorites. I'll edit the selected ones.\n\nBest,\n[摄影师姓名]`,
      },
      selection_reminder: {
        subject: `Gentle reminder: ${ctx.projectTitle} proofs selection`,
        body: `Hi ${ctx.clientName},\n\nJust a friendly reminder — you have ${ctx.daysLeft || 2} days left to select your favorite photos from ${ctx.projectTitle}. Please submit your selection soon so I can begin editing!\n\nSelection link: ${ctx.shareUrl}\n\nThank you!\n[摄影师姓名]`,
      },
      selection_overdue: {
        subject: `Action needed: ${ctx.projectTitle} selection overdue`,
        body: `Hi ${ctx.clientName},\n\nThe selection deadline for ${ctx.projectTitle} has passed. Please submit your photo selections today to avoid delays. If you're having trouble with the selection page, let me know and I'll help.\n\nSelection link: ${ctx.shareUrl}\n\nThank you,\n[摄影师姓名]`,
      },
      delivery_ready: {
        subject: `Your edited photos for ${ctx.projectTitle} — Round ${ctx.roundNumber || 1}`,
        body: `Hi ${ctx.clientName},\n\nGreat news! Round ${ctx.roundNumber || 1} of your edited photos for ${ctx.projectTitle} is ready for review.\n\nReview link: ${ctx.shareUrl}\n\nPlease review and mark any specific revision requests. Deadline: ${ctx.deadline || '3 days'}.\n\nBest,\n[摄影师姓名]`,
      },
      review_reminder: {
        subject: `Quick reminder: ${ctx.projectTitle} photo review`,
        body: `Hi ${ctx.clientName},\n\nJust a quick reminder — you have ${ctx.daysLeft || 1} day(s) left to review your photos for ${ctx.projectTitle}. Link: ${ctx.shareUrl}\n\nThank you!\n[摄影师姓名]`,
      },
      delivery_accepted: {
        subject: `Thank you — ${ctx.projectTitle}`,
        body: `Hi ${ctx.clientName},\n\nThank you for reviewing your photos! I'm glad you're happy with them.\n\nDownload link for all final high-resolution images: ${ctx.shareUrl}\n\nIt was a pleasure working with you!\n\nBest,\n[摄影师姓名]`,
      },
    };
    return templates[type];
  }
}

/**
 * 截止日检查器 — 每个 email-watcher poll 周期调用
 * 扫描所有活跃项目 → 检查截止日 → 返回需要发送的提醒列表
 */
export interface ReminderJob {
  type: NotificationType;
  clientEmail: string;
  clientName: string;
  subject: string;
  body: string;
}

export async function checkDeadlines(): Promise<ReminderJob[]> {
  const { queryAll, queryOne } = await import('../db/query.js');
  const { initDb } = await import('../db/schema.js');
  await initDb();

  const jobs: ReminderJob[] = [];
  const now = Date.now();

  // 1. 选片截止提醒
  const activeGalleries = queryAll(
    `SELECT g.*, p.title as project_title, c.name as client_name, c.email as client_email
     FROM project_galleries g
     JOIN projects p ON g.project_id = p.id
     JOIN clients c ON p.client_id = c.id
     WHERE g.selection_status = 'awaiting_selection'
        OR g.selection_status = 'selection_in_progress'
        OR g.selection_status = 'overdue'`
  ) as any[];

  for (const g of activeGalleries) {
    if (!g.selection_deadline || !g.client_email) continue;
    const deadline = new Date(g.selection_deadline).getTime();
    const hoursLeft = Math.floor((deadline - now) / 3600000);

    if (hoursLeft <= 48 && hoursLeft > 24 && g.selection_status !== 'overdue') {
      // 48h 提醒 — 只发一次
      const lastReminder = g.metadata ? JSON.parse(g.metadata || '{}').lastReminder48h : null;
      if (!lastReminder) {
        const draft = await draftNotification('selection_reminder', {
          clientName: g.client_name || 'Client',
          clientEmail: g.client_email,
          projectTitle: g.project_title || 'Project',
          details: '',
          shareUrl: g.share_token ? `/portal/selection/${g.share_token}` : '',
          daysLeft: Math.floor(hoursLeft / 24),
        });
        jobs.push({ type: 'selection_reminder', clientEmail: g.client_email, clientName: g.client_name, ...draft });
        // Mark as reminded
        const meta = JSON.parse(g.metadata || '{}');
        meta.lastReminder48h = new Date().toISOString();
        const { run } = await import('../db/query.js');
        run('UPDATE project_galleries SET metadata=? WHERE id=?', [JSON.stringify(meta), g.id]);
      }
    }

    if (hoursLeft <= 24 && hoursLeft > 0 && g.selection_status !== 'overdue') {
      const lastReminder = g.metadata ? JSON.parse(g.metadata || '{}').lastReminder24h : null;
      if (!lastReminder) {
        const draft = await draftNotification('selection_reminder', {
          clientName: g.client_name || 'Client',
          clientEmail: g.client_email,
          projectTitle: g.project_title || 'Project',
          details: '',
          shareUrl: g.share_token ? `/portal/selection/${g.share_token}` : '',
          daysLeft: Math.floor(hoursLeft / 24) || 1,
        });
        jobs.push({ type: 'selection_reminder', clientEmail: g.client_email, clientName: g.client_name, ...draft });
        const meta = JSON.parse(g.metadata || '{}');
        meta.lastReminder24h = new Date().toISOString();
        const { run } = await import('../db/query.js');
        run('UPDATE project_galleries SET metadata=? WHERE id=?', [JSON.stringify(meta), g.id]);
      }
    }

    if (hoursLeft <= -72 && g.selection_status !== 'selection_done') {
      // 逾期3天 — 发一次最后警告
      const lastOverdue = g.metadata ? JSON.parse(g.metadata || '{}').lastOverdueReminder : null;
      if (!lastOverdue) {
        const draft = await draftNotification('selection_overdue', {
          clientName: g.client_name || 'Client',
          clientEmail: g.client_email,
          projectTitle: g.project_title || 'Project',
          details: '',
          shareUrl: g.share_token ? `/portal/selection/${g.share_token}` : '',
          daysLeft: Math.abs(Math.floor(hoursLeft / 24)),
        });
        jobs.push({ type: 'selection_overdue', clientEmail: g.client_email, clientName: g.client_name, ...draft });
        const meta = JSON.parse(g.metadata || '{}');
        meta.lastOverdueReminder = new Date().toISOString();
        const { run } = await import('../db/query.js');
        run('UPDATE project_galleries SET metadata=? WHERE id=?', [JSON.stringify(meta), g.id]);
      }
    }
  }

  // 2. 审核截止提醒
  const pendingReviews = queryAll(
    `SELECT d.*, p.title as project_title, c.name as client_name, c.email as client_email
     FROM delivery_rounds d
     JOIN projects p ON d.project_id = p.id
     JOIN clients c ON p.client_id = c.id
     WHERE d.status = 'pending_review'`
  ) as any[];

  for (const r of pendingReviews) {
    if (!r.review_deadline || !r.client_email) continue;
    const deadline = new Date(r.review_deadline).getTime();
    const hoursLeft = Math.floor((deadline - now) / 3600000);

    if (hoursLeft <= 24 && hoursLeft > 0) {
      const draft = await draftNotification('review_reminder', {
        clientName: r.client_name || 'Client',
        clientEmail: r.client_email,
        projectTitle: r.project_title || 'Project',
        details: '',
        shareUrl: r.share_token ? `/portal/review/${r.share_token}` : '',
        daysLeft: Math.floor(hoursLeft / 24) || 1,
        roundNumber: r.round_number,
      });
      jobs.push({ type: 'review_reminder', clientEmail: r.client_email, clientName: r.client_name, ...draft });
    }
  }

  return jobs;
}
