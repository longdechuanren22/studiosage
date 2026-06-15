// Offline rules engine — works without any API key
// Production-grade keyword matching + stage-based templates

const URGENT_PATTERNS = [
  /urgent/i, /asap/i, /emergency/i, /cancel/i, /refund/i, /complaint/i,
  /wrong/i, /error/i, /issue/i, /problem/i, /broken/i, /doesn.?t work/i,
  /not working/i, /can.?t access/i, /can.?t download/i, /gallery.*down/i,
  /wedding.*(tomorrow|today|soon)/i, /deadline/i,
];

// Broad spam detection: newsletters, promos, receipts, automated, social, etc.
const SPAM_PATTERNS = [
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

// Business-related keywords — messages containing these are likely photography clients
const BUSINESS_PATTERNS = [
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

  // Urgent check first
  if (URGENT_PATTERNS.some(p => p.test(text))) return 'urgent';

  // Strong spam signal: matches spam patterns AND no business keywords
  const spamMatches = SPAM_PATTERNS.filter(p => p.test(text)).length;
  const bizMatches = BUSINESS_PATTERNS.filter(p => p.test(text)).length;

  // Heavily weighted: if spam signals dominate and no business context, mark spam
  if (spamMatches >= 3 && bizMatches === 0) return 'spam';
  if (spamMatches >= 2 && bizMatches === 0 && text.length < 500) return 'spam';
  // Single strong spam signal without business context → spam
  if (spamMatches >= 1 && bizMatches === 0 && text.length < 200) return 'spam';
  // Promotional/automated content that doesn't look like a real person emailing
  if (spamMatches >= 2 && bizMatches <= 1) return 'spam';

  return 'normal';
}

const REPLY_TEMPLATES: Record<string, Record<string, string>> = {
  inquiry: {
    wedding: "Hi! Thanks so much for reaching out! I'd love to chat about your wedding. My packages start at $3,500 and include 8 hours of coverage + 600+ edited images. What date are you looking at? I'll check availability right away!",
    portrait: "Hi! Thanks for your interest! My portrait sessions start at $450 and include 1 hour of shooting + 50+ edited images. What type of portraits are you looking for? Happy to share more details!",
    default: "Hi! Thanks for reaching out! I'd love to hear more about what you're looking for. What type of photography are you interested in, and what dates work for you?",
  },
  post_production: {
    default: "Hi! I'm currently working on your photos and they're turning out beautifully! The usual turnaround is 2-3 weeks from the shoot date. I'll send you a sneak peek in the next few days. Thanks for your patience!",
  },
  delivery: {
    default: "Hi! Here's the link to your gallery. The password is the same as before. Let me know if you have any trouble accessing it! If you'd like to order prints or create an album, you can do so directly from the gallery.",
  },
  post_delivery: {
    default: "Thank you so much! I'm thrilled you love them. It was such a pleasure working with you. If you ever need more photos in the future, I'd love to work together again!",
  },
};

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
  const pkg = clientContext?.packageType || 'default';
  const templates = REPLY_TEMPLATES[stage] || REPLY_TEMPLATES.inquiry;
  const reply = (templates as any)[pkg] || templates.default || REPLY_TEMPLATES.inquiry.default;

  return {
    category,
    summary: `${category} message about ${stage.replace('_', ' ')}`,
    suggestedReply: reply,
    confidence: 0.75,
    stage,
  };
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
