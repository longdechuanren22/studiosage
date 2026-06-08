// Offline rules engine — works without any API key
// Production-grade keyword matching + stage-based templates
const URGENT_PATTERNS = [
    /urgent/i, /asap/i, /emergency/i, /cancel/i, /refund/i, /complaint/i,
    /wrong/i, /error/i, /issue/i, /problem/i, /broken/i, /doesn.?t work/i,
    /not working/i, /can.?t access/i, /can.?t download/i, /gallery.*down/i,
    /wedding.*(tomorrow|today|soon)/i, /deadline/i,
];
const SPAM_PATTERNS = [
    /seo/i, /backlink/i, /guest post/i, /sponsor/i, /buy.*followers/i,
    /click.*link/i, /win.*free/i, /congratulations.*winner/i,
    /unsubscribe/i, /marketing.*solution/i, /lead.*generation/i,
];
const STAGE_KEYWORDS = {
    inquiry: ['price', 'cost', 'available', 'package', 'booking', 'inquire', 'how much', 'do you shoot'],
    booking: ['contract', 'deposit', 'retainer', 'sign', 'payment', 'invoice'],
    pre_shoot: ['what to wear', 'location', 'timeline', 'schedule', 'when to arrive', 'preparation'],
    post_production: ['ready', 'done', 'finished', 'sneak peek', 'how long', 'when will', 'progress', 'status', 'photos'],
    delivery: ['download', 'password', 'gallery', 'link', 'access', 'can\'t open', 'gallery not'],
    post_delivery: ['thank', 'love', 'amazing', 'beautiful', 'print', 'album', 'order', 'more photos'],
};
function detectStage(body, subject) {
    const text = (subject + ' ' + body).toLowerCase();
    let bestStage = 'inquiry';
    let bestScore = 0;
    for (const [stage, keywords] of Object.entries(STAGE_KEYWORDS)) {
        const score = keywords.filter(k => text.includes(k)).length;
        if (score > bestScore) {
            bestScore = score;
            bestStage = stage;
        }
    }
    return bestScore > 0 ? bestStage : 'inquiry';
}
function detectCategory(body, subject) {
    const text = subject + ' ' + body;
    if (SPAM_PATTERNS.some(p => p.test(text)))
        return 'spam';
    if (URGENT_PATTERNS.some(p => p.test(text)))
        return 'urgent';
    return 'normal';
}
const REPLY_TEMPLATES = {
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
const PACKAGE_DEFAULTS = {
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
export function classifyOffline(body, subject, clientContext) {
    const stage = clientContext?.stage || detectStage(body, subject);
    const category = detectCategory(body, subject);
    const pkg = clientContext?.packageType || 'default';
    const templates = REPLY_TEMPLATES[stage] || REPLY_TEMPLATES.inquiry;
    const reply = templates[pkg] || templates.default || REPLY_TEMPLATES.inquiry.default;
    return {
        category,
        summary: `${category} message about ${stage.replace('_', ' ')}`,
        suggestedReply: reply,
        confidence: 0.75,
        stage,
    };
}
export function generateInvoiceOffline(params) {
    const items = PACKAGE_DEFAULTS[params.packageType] || PACKAGE_DEFAULTS.portrait;
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const adjustment = params.amount - subtotal;
    const allItems = adjustment !== 0
        ? [...items, { description: 'Package adjustment', quantity: 1, unitPrice: adjustment }]
        : items;
    return {
        items: allItems,
        subtotal: params.amount,
        retainerLabel: 'non-refundable-retainer',
        paymentSchedule: params.paymentSchedule === 'three-phase' ? [
            { label: 'Retainer (50%)', amount: Math.round(params.amount * 0.5), dueDate: 'upon signing' },
            { label: 'Pre-Event (25%)', amount: Math.round(params.amount * 0.25), dueDate: '30 days before shoot' },
            { label: 'Final Balance (25%)', amount: Math.round(params.amount * 0.25), dueDate: 'upon gallery delivery' },
        ] : [{ label: 'Full payment', amount: params.amount, dueDate: 'upon receipt' }],
        notes: 'Retainer is non-refundable. Final payment is required before gallery download access is granted.',
        taxNote: 'Physical products (prints, albums) may be subject to sales tax. Digital files are tax-exempt in most jurisdictions.',
    };
}
