// Offline rules engine — works without any API key
// Production-grade keyword matching + stage-based templates

const URGENT_PATTERNS = [
  /urgent/i, /asap/i, /emergency/i, /cancel/i, /refund/i, /complaint/i,
  /wrong/i, /error/i, /issue/i, /problem/i, /broken/i, /doesn.?t work/i,
  /not working/i, /can.?t access/i, /can.?t download/i, /gallery.*down/i,
  /wedding.*(tomorrow|today|soon)/i, /deadline/i,
];

// Broad spam detection: newsletters, promos, receipts, automated, social, etc.
// Includes Chinese-language spam patterns (QQ/163/126 mailboxes)
const SPAM_PATTERNS = [
  // ── Universal: domain + sender patterns (language-agnostic) ──
  /@linkedin\.com/i, /@steampowered\.com/i, /@newsletter\./i,
  /noreply@/i, /no-reply@/i, /jobs-listings@/i, /messages-noreply@/i,
  /invitations@linkedin/i, /^donotreply@/i, /^mailer-daemon@/i,
  /@facebookmail\.com/i, /@amazon\.com/i, /@netflix\.com/i,

  // ── Universal: content patterns (language-agnostic) ──
  /unsubscribe/i, /opt.out/i, /email preferences/i, /update.*(subscription|preferences)/i,
  /view (in|online|as webpage|in browser)/i,
  /(weekly|monthly|daily).*(newsletter|digest|roundup)/i,
  /(webinar|free ebook|whitepaper|case study)/i,
  /limited.time.offer|act.now|don't miss out|exclusive deal/i,
  /(sale|discount|promo|clearance).*(off|code|ends|save|up to)/i,
  /(shipping|tracking|package|delivery).*(update|confirm|notification)/i,
  /(order|receipt|purchase).*(confirm|#|number)/i,
  /congratulations.*(winner|won|selected|chosen)/i,
  /earn.*(money|cash|income).*(home|online)/i,
  /casino|gambling|poker|betting|lottery/i,
  /pharmacy|viagra|cialis|weight.loss/i,
  /loan.*(approv|low.rate)|credit.*repair/i,
  /\b(SEO|backlink|guest post|sponsor|followers|traffic)\b/i,
  /(facebook|instagram|linkedin|twitter|tiktok|snapchat|pinterest).*(notif|mention|follow|like|comment)/i,

  // ── Supplementary: Chinese spam (common for QQ/163/126 mailboxes) ──
  /\(AD\)|（广告）|\[广告\]/,
  /会员.*开通|会员.*到期|VIP.*开通/,
  /星座|运势|horoscope/i,
  /特卖|促销|折扣|优惠|降价|打折|清仓|甩卖|秒杀|特价/,
  /招聘|求职|简历|猎头|内推|offer|面试/,
  /职业.*档案|职业.*背景|看过.*档案|添加.*好友|认可.*成就/,
  /广告|营销|推广|满减|专属推荐|为你推荐|猜你喜欢|精选推荐/,
  /订阅|退订|不再接收|邮件订阅|邮件列表/,
  /系统通知|系统邮件|自动发送|自动生成|请勿回复/,
  /验证码|验证邮件|激活账号|激活账户|安全提醒|安全通知|登录提醒|异地登录/,
  /账单|对账|流水|交易提醒|消费提醒|扣款通知|还款提醒/,
  /快递|物流|配送|发货|收货|包裹|签收|运单/,
  /充值|缴费|续费|积分.*兑换|积分.*清零/,
  /恭喜.*中奖|恭喜.*获得|免费领取|免费获得|0元.*领/,
  /点击.*链接|点击查看|查看详情|立即查看|立即购买|立即参与/,
  /转发.*(得|送|赚)|分享.*(得|送|赚)|邀请.*(得|送|赚)/,
  /关注.*公众号|扫码|二维码|加微信|加群|入群/,
  /(京东|淘宝|天猫|拼多多|美团|饿了么|抖音|快手).*(店|商城|旗舰|官方)/,
  /信用卡|贷款|借款|理财|基金|股票|保险|免息/,
  /学位|学历|培训|课程|考证|报名|学习/,
  /发票代开|代开发票|办理.*证件|刻章/,
  /赌博|博彩|彩票|六合彩|棋牌|赌场/,
  /(在家|手机).*(赚钱|兼职|日结|月入)/,

  // ── English spam ──
  // Marketing / newsletters
  /unsubscribe/i, /view in browser/i, /weekly digest/i, /newsletter/i,
  /monthly roundup/i, /webinar/i, /free ebook/i, /whitepaper/i,
  /limited time offer/i, /special offer/i, /discount code/i, /promo code/i,
  /flash sale/i, /clearance/i, /save up to/i, /buy one get one/i,

  // SEO / spam / cold outreach
  /seo/i, /backlink/i, /guest post/i, /sponsor/i, /buy.*followers/i,
  /click.*link/i, /win.*free/i, /congratulations.*winner/i,
  /marketing.*solution/i, /lead.*generation/i, /cold.*email/i,

  // Receipts / purchases / shipping
  /order (confirm|#|number)/i, /shipping (confirm|update)/i,
  /tracking (number|update)/i, /your.*receipt/i, /payment receipt/i,
  /purchase confirm/i, /invoice.*from.*(amazon|apple|google)/i,
  /your.*(order|purchase).*(confirmed|shipped|delivered)/i,
  /package.*(delivered|on its way|shipped)/i,

  // Social media notifications
  /(facebook|instagram|twitter|linkedin|tiktok|snapchat|pinterest).*notif/i,
  /new follower/i, /mentioned you/i, /tagged you/i,
  /someone.*(liked|commented|followed|viewed)/i,
  /notification from (facebook|instagram|linkedin|twitter)/i,

  // System / automated emails
  /password reset/i, /login attempt/i, /security alert/i,
  /verify your (email|account)/i, /confirm your (email|account)/i,
  /account.*verification/i, /two.factor/i, /2fa/i,
  /your.*code is/i, /sign.in.*from/i, /new.*sign.in/i,

  // Banking / finance
  /account statement/i, /credit card.*statement/i,
  /monthly statement/i, /balance.*alert/i, /payment due/i,
  /bill.*due/i, /automatic payment/i,

  // Calendar / scheduling platform emails (not direct client messages)
  /reminder:.*(meeting|event|appointment)/i,
  /you have.*(meeting|event).*(tomorrow|today|in.*hour)/i,

  // Job / recruiting
  /job (opening|opportunity|alert)/i, /career/i, /hiring/i,
  /recruiter/i, /we.*like.*your.*(profile|resume|portfolio)/i,

  // Survey / feedback
  /(survey|feedback).*request/i, /tell us about your experience/i,
  /rate your/i, /review your.*purchase/i,
];

// Business-related keywords — messages containing these are likely real clients
const BUSINESS_PATTERNS = [
  // Photography specific
  /photograph/i, /shoot/i, /wedding/i, /portrait/i, /session/i,
  /package/i, /price/i, /quote/i, /estimate/i, /available/i,
  /book/i, /schedule/i, /date/i, /venue/i, /coverage/i,
  /album/i, /print/i, /photo/i, /picture/i, /gallery/i,
  /contract/i, /deposit/i, /retainer/i, /payment/i, /invoice/i,
  /engagement/i, /bridal/i, /event/i, /party/i, /ceremony/i,
  /how much do you charge/i, /are you available/i, /can you shoot/i,
  /looking for a photographer/i, /need a photographer/i,
  /do you (do|shoot|photograph|cover)/i, /interested in/i,
  /checking in/i, /following up/i, /just wanted to/i,
  // General business inquiry (real people asking questions)
  /\?/, // Any question mark — real people ask questions
  /^(hi|hey|hello|dear|good morning|good afternoon)\b/im, // Greeting
  /(thanks|thank you|appreciate|best|regards|cheers)/i, // Polite
  /^(my name is|I am|I'm|we are|we're)\b/im, // Self-intro
  /(looking for|interested in|do you|could you|would you|can you|wondering)/i, // Inquiry
  /(let me know|get back to me|reply|respond|contact)/i, // Expecting reply
  /(recommend|suggest|advice|opinion|thoughts)/i, // Asking for opinion
  /(talk|chat|call|meet|discuss)/i, // Want to communicate
  /(week|month|year|tomorrow|next week|this week)/i, // Time reference
];

const STAGE_KEYWORDS: Record<string, string[]> = {
  inquiry: ['price', 'cost', 'available', 'package', 'booking', 'inquire', 'how much', 'do you shoot'],
  booking: ['contract', 'deposit', 'retainer', 'sign', 'payment', 'invoice'],
  pre_shoot: ['what to wear', 'location', 'timeline', 'schedule', 'when to arrive', 'preparation'],
  post_production: ['ready', 'done', 'finished', 'sneak peek', 'how long', 'when will', 'progress', 'status', 'photos'],
  delivery: ['download', 'password', 'gallery', 'link', 'access', 'can\'t open', 'gallery not'],
  post_delivery: ['thank', 'love', 'amazing', 'beautiful', 'print', 'album', 'order', 'more photos'],
};

function detectStage(body: string, subject: string): string {
  const text = (subject + ' ' + body).toLowerCase();
  let bestStage = 'inquiry';
  let bestScore = 0;
  for (const [stage, keywords] of Object.entries(STAGE_KEYWORDS)) {
    const score = keywords.filter(k => text.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestStage = stage; }
  }
  return bestScore > 0 ? bestStage : 'inquiry';
}

function detectCategory(body: string, subject: string): 'urgent' | 'normal' | 'spam' {
  const text = subject + ' ' + body;

  // Urgent check first (language-agnostic: cancel/refund/urgent/emergency)
  if (URGENT_PATTERNS.some(p => p.test(text))) return 'urgent';

  const spamMatches = SPAM_PATTERNS.filter(p => p.test(text)).length;
  const bizMatches = BUSINESS_PATTERNS.filter(p => p.test(text)).length;

  // Only mark spam if overwhelming evidence (language-agnostic threshold)
  // 3+ spam signals AND zero business signals = spam
  if (spamMatches >= 3 && bizMatches === 0) return 'spam';
  // 5+ spam signals even with some business context = spam
  if (spamMatches >= 5 && bizMatches <= 2) return 'spam';

  // Default: normal (false negatives > false positives)
  return 'normal';
}

export interface ClassifyResult {
  category: 'urgent' | 'normal' | 'spam';
  summary: string;
  suggestedReply: string;
  confidence: number;
  stage: string;
}

export interface InvoiceItem { description: string; quantity: number; unitPrice: number; }

export interface GenerateInvoiceParams {
  photographerName: string; photographerEmail: string;
  clientName: string; clientEmail: string;
  packageType: string; amount: number;
  currency?: string; paymentSchedule?: 'single' | 'three-phase';
}

const PACKAGE_DEFAULTS: Record<string, InvoiceItem[]> = {
  wedding: [
    { description: 'Full-day wedding coverage (8 hours)', quantity: 1, unitPrice: 2500 },
    { description: 'Second photographer', quantity: 1, unitPrice: 600 },
    { description: 'Engagement session', quantity: 1, unitPrice: 400 },
    { description: 'Edited digital images (600+)', quantity: 1, unitPrice: 0 },
    { description: 'Online gallery + download', quantity: 1, unitPrice: 0 },
  ],
  portrait: [
    { description: 'Portrait session (1 hour)', quantity: 1, unitPrice: 350 },
    { description: 'Edited digital images (50+)', quantity: 1, unitPrice: 100 },
    { description: 'Online gallery + download', quantity: 1, unitPrice: 0 },
  ],
  event: [
    { description: 'Event coverage (4 hours)', quantity: 1, unitPrice: 1200 },
    { description: 'Edited digital images (200+)', quantity: 1, unitPrice: 0 },
    { description: 'Online gallery + download', quantity: 1, unitPrice: 0 },
  ],
  commercial: [
    { description: 'Commercial shoot (half day)', quantity: 1, unitPrice: 1800 },
    { description: 'Image licensing (web + print)', quantity: 1, unitPrice: 500 },
    { description: 'Edited digital images', quantity: 1, unitPrice: 0 },
  ],
};

export function classifyOffline(body: string, subject: string, clientContext?: { name?: string; stage?: string; packageType?: string }): ClassifyResult {
  const stage = clientContext?.stage || detectStage(body, subject);
  const category = detectCategory(body, subject);
  const reply = generateSmartReply(body, subject, stage, clientContext);

  return {
    category,
    summary: `${category} message about ${stage.replace('_', ' ')}`,
    suggestedReply: reply,
    confidence: 0.75,
    stage,
  };
}

// Generate a context-aware reply based on what the client actually said
function generateSmartReply(body: string, subject: string, stage: string, ctx?: { name?: string; stage?: string; packageType?: string }): string {
  const text = (subject + ' ' + body).toLowerCase();
  const isReply = /^re:/i.test(subject);
  const clientName = ctx?.name || '';

  // ── Detect what the client is asking about ──
  const shootType = detectShootType(text);
  const hasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december| next |this |week|month|202[0-9])\b/i.test(text)
    || /[0-9]+月|[0-9]+日|明年|今年|下[个周月]|这[个周月]/.test(text);
  const hasBudget = /(budget|price|cost|rate|charge|fee|how much|多少钱|价格|费用|收费|报价)/i.test(text);
  const hasLocation = /(location|venue|where|place|地点|位置|哪里|地址)/i.test(text);
  const hasQuestion = /\?/.test(text);

  // ── Build reply based on stage and context ──
  const greeting = clientName ? `Hi ${clientName}!` : 'Hi!';

  if (stage === 'inquiry' || stage === 'engaged') {
    let reply = greeting + ' ';

    // Acknowledge what they asked about
    if (shootType) {
      const typeLabel: Record<string, string> = {
        wedding: 'wedding', portrait: 'portrait session', child: 'child/family photoshoot',
        event: 'event', commercial: 'commercial shoot', newborn: 'newborn session',
        birthday: 'birthday celebration', maternity: 'maternity session',
      };
      const label = typeLabel[shootType] || shootType + ' photography';
      reply += `Thanks for reaching out about the ${label}! `;

      if (shootType === 'child' || shootType === 'birthday' || shootType === 'newborn') {
        reply += `I'd love to capture these special moments for your little one. `;
      } else if (shootType === 'wedding') {
        reply += `Congratulations on your engagement! I'd love to hear more about your wedding plans. `;
      } else if (shootType === 'portrait' || shootType === 'maternity') {
        reply += `I'd love to create beautiful portraits for you. `;
      }
    } else {
      reply += `Thanks for reaching out! `;
    }

    // Respond to specific questions
    if (hasBudget && shootType) {
      const prices: Record<string, string> = {
        wedding: 'Wedding packages start at $3,500 for 8 hours of coverage.',
        portrait: 'Portrait sessions start at $450 for 1 hour.',
        child: 'Family/child sessions start at $450 for 1 hour.',
        event: 'Event coverage starts at $1,200 for 4 hours.',
        newborn: 'Newborn sessions start at $500.',
        birthday: 'Birthday party coverage starts at $600.',
      };
      reply += prices[shootType] || 'I\'d be happy to share my pricing with you. ';
    }

    if (hasDate) {
      reply += `I'll check my availability — could you share the specific date you have in mind? `;
    } else {
      reply += `What date are you looking at? I'll check availability right away! `;
    }

    if (hasLocation) {
      reply += `I'm happy to travel to your location. Let me know where it'll be and I can confirm. `;
    }

    if (!hasQuestion) {
      reply += `Feel free to share more details — I'm happy to customize a package for you.`;
    }

    return reply;
  }

  // Follow-up / ongoing conversation
  if (isReply) {
    return `${greeting} Got it, thanks for the follow-up! I've noted the details. Let me know if anything else comes up, and we'll get everything sorted.`;
  }

  if (stage === 'booking') {
    return `${greeting} Great! I've attached the contract and invoice for your review. Once the retainer is received, the date is confirmed. Let me know if you have any questions!`;
  }

  if (stage === 'post_production') {
    return `${greeting} I'm working on your photos — they're looking beautiful! The usual turnaround is 2-3 weeks. I'll send a sneak peek in the next few days. Thanks for your patience!`;
  }

  if (stage === 'delivery') {
    return `${greeting} Here's the link to your gallery! The password is the same as before. You can order prints and albums directly from the gallery. Let me know if you have any trouble accessing it!`;
  }

  // Default fallback
  return `${greeting} Thanks for your message! I'll get back to you shortly with more details.`;
}

// Detect the type of photography shoot from email content
function detectShootType(text: string): string | null {
  // Chinese patterns first (for QQ/163 mailboxes)
  if (/周岁|百天|满月|宝宝|婴儿|孩子|儿童|亲子|小孩|宝贝|萌宝/i.test(text)) return 'child';
  if (/生日.*(拍|照|摄影|写真|聚会|派对|庆祝)/i.test(text) || /(拍|照|摄影).*生日/i.test(text)) return 'birthday';
  if (/孕妇|孕照|孕期|大肚子|怀孕/i.test(text)) return 'maternity';
  if (/婚礼|婚庆|结婚|新娘|新郎|订婚|婚纱/i.test(text)) return 'wedding';
  if (/写真|个人|形象|肖像/i.test(text)) return 'portrait';
  if (/活动|年会|开业|庆典|会议|发布会/i.test(text)) return 'event';
  if (/产品|商品|电商|淘宝|服装|美食/i.test(text)) return 'commercial';
  if (/新生儿|刚出生/i.test(text)) return 'newborn';

  // English patterns
  if (/wedding|bride|groom|bridal|marriage|ceremony|reception/i.test(text)) return 'wedding';
  if (/portrait|headshot|maternity|pregnant|pregnancy|baby bump/i.test(text)) return 'portrait';
  if (/newborn|just born|baby.*(photo|shoot|session|picture)/i.test(text)) return 'newborn';
  if (/(child|kid|family|toddler|baby|infant).*(photo|shoot|session|picture|portrait)/i.test(text)
    || /(photo|shoot|session).*(child|kid|family|toddler|baby|infant)/i.test(text)) return 'child';
  if (/birthday.*(party|celebration|photo|shoot|session)/i.test(text)
    || /(photo|shoot).*birthday/i.test(text)) return 'birthday';
  if (/event|party|corporate|gala|conference|celebration/i.test(text)) return 'event';
  if (/commercial|product|real.estate|food|fashion|catalog/i.test(text)) return 'commercial';

  // Generic photography interest
  if (/photograph|photo|shoot|session|picture|portrait/i.test(text)) return 'portrait';

  return null;
}

export function generateInvoiceOffline(params: GenerateInvoiceParams) {
  const items = PACKAGE_DEFAULTS[params.packageType] || PACKAGE_DEFAULTS.portrait;
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const adjustment = params.amount - subtotal;
  const allItems = adjustment !== 0
    ? [...items, { description: 'Package adjustment', quantity: 1, unitPrice: adjustment }]
    : items;

  return {
    items: allItems,
    subtotal: params.amount,
    retainerLabel: 'non-refundable-retainer' as const,
    paymentSchedule: params.paymentSchedule === 'three-phase' ? [
      { label: 'Retainer (50%)', amount: Math.round(params.amount * 0.5), dueDate: 'upon signing' },
      { label: 'Pre-Event (25%)', amount: Math.round(params.amount * 0.25), dueDate: '30 days before shoot' },
      { label: 'Final Balance (25%)', amount: Math.round(params.amount * 0.25), dueDate: 'upon gallery delivery' },
    ] : [{ label: 'Full payment', amount: params.amount, dueDate: 'upon receipt' }],
    notes: 'Retainer is non-refundable. Final payment is required before gallery download access is granted.',
    taxNote: 'Physical products (prints, albums) may be subject to sales tax. Digital files are tax-exempt in most jurisdictions.',
  };
}
