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
    // ── Photographer-specific scams/spam (from industry research) ──
    /your website.*(?:isn'?t|not).*ranking/i, /page 1 of google/i,
    /broken links.*(?:on|found).*site/i, /SEO.*(?:audit|report|improve)/i,
    /guest (?:post|article).*(?:photography|photo|blog)/i,
    /feature your (?:work|photo|image).*(?:magazine|blog|website)/i,
    /times square.*(?:photo|image|feature)/i,
    /overpayment|over.paid|cashier.?s check|refund.*difference/i,
    /hearing.impaired|out of (?:town|country).*(?:only|communicate).*email/i,
    /(?:god bless|in good health).*(?:photography|booking)/i,
    /fake.*(?:invoice|payment)|(?:quickbooks|paypal).*(?:verify|confirm|update)/i,
    /copyright.*(?:infringement|violation|notice).*(?:image|photo|picture)/i,
    /directory.*(?:listing|submission).*(?:photography|photographer)/i,
    /(?:finder'?s|finders).*fee.*photographer/i,
    /sponsor.*(?:post|content|article).*(?:photography|photo)/i,
    // More photographer scams from global community research
    /elopement.*(?:photo|shoot).*(?:just.*us|two|witness)/i, // Fake elopement inquiry
    /surprise.*(?:wedding|proposal|engagement).*(?:photo|shoot|photographer)/i, // Fake surprise proposal
    /corporate.*(?:headshot|portrait).*(?:\d+).*(?:employees|staff|team)/i, // Fake corporate shoot
    /instagram.*(?:verify|verification|badge|blue.*check)/i, // IG verification phishing
    /(?:feature|publish).*(?:magazine|vogue|times square|billboard)/i, // Fake magazine feature
    /(?:print|album).*(?:sale|discount|clearance|blowout)/i, // Mass-market print sale spam
    /(?:model|acting|talent).*(?:scout|agency|looking.*(?:face|look))/i, // Fake model scout
    /(?:influencer|collab|exposure).*(?:free|trade|TF)/i, // "Exposure" payment offer
    /(?:wedding|event).*(?:cancelled|canceled|cancel|postpone).*(?:refund|money back)/i, // Fake cancellation
    // ── Supplementary: Chinese spam ──
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
    // Urgent check first (language-agnostic: cancel/refund/urgent/emergency)
    if (URGENT_PATTERNS.some(p => p.test(text)))
        return 'urgent';
    const spamMatches = SPAM_PATTERNS.filter(p => p.test(text)).length;
    const bizMatches = BUSINESS_PATTERNS.filter(p => p.test(text)).length;
    // Only mark spam if overwhelming evidence (language-agnostic threshold)
    // 3+ spam signals AND zero business signals = spam
    if (spamMatches >= 3 && bizMatches === 0)
        return 'spam';
    // 5+ spam signals even with some business context = spam
    if (spamMatches >= 5 && bizMatches <= 2)
        return 'spam';
    // Default: normal (false negatives > false positives)
    return 'normal';
}
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
    const reply = generateSmartReply(body, subject, stage, clientContext);
    // Offline sentiment + pricing intent detection
    const pricingKeywords = /how much|price|pricing|cost|rate|fee|discount|package price|多少钱|价格|费用|报价|收费/i;
    const text = (subject + ' ' + body).toLowerCase();
    const sentiment = /urgent|asap|emergency|immediately|right now|紧急|马上|立刻/i.test(text) ? 'urgent'
        : /angry|frustrated|complaint|refund|cancel|生气|退款|取消|投诉/i.test(text) ? 'frustrated'
            : /worried|nervous|concerned|scared|担心|紧张/i.test(text) ? 'anxious'
                : 'neutral';
    const pricingIntent = pricingKeywords.test(text);
    const needsImmediateAttention = category === 'urgent' || sentiment === 'urgent' || sentiment === 'frustrated';
    return {
        category,
        summary: `${category} message about ${stage.replace('_', ' ')}`,
        suggestedReply: reply,
        confidence: 0.75,
        stage,
        sentiment: sentiment,
        pricingIntent,
        needsImmediateAttention,
    };
}
// Generate a context-aware reply based on what the client actually said
function generateSmartReply(body, subject, stage, ctx) {
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
            const typeLabel = {
                wedding: 'wedding', portrait: 'portrait session', child: 'child/family photoshoot',
                event: 'event', commercial: 'commercial shoot', newborn: 'newborn session',
                birthday: 'birthday celebration', maternity: 'maternity session',
            };
            const label = typeLabel[shootType] || shootType + ' photography';
            reply += `Thanks for reaching out about the ${label}! `;
            if (shootType === 'child' || shootType === 'birthday' || shootType === 'newborn') {
                reply += `I'd love to capture these special moments for your little one. `;
            }
            else if (shootType === 'wedding') {
                reply += `Congratulations on your engagement! I'd love to hear more about your wedding plans. `;
            }
            else if (shootType === 'portrait' || shootType === 'maternity') {
                reply += `I'd love to create beautiful portraits for you. `;
            }
        }
        else {
            reply += `Thanks for reaching out! `;
        }
        // 🔒 安全：AI 不报具体价格。引导客户查看摄影师自设的套餐页面。
        if (hasBudget && shootType) {
            reply += 'I have packages for this type of shoot — I\'d be happy to send you a custom proposal once I understand your needs better. ';
        }
        // ── Seasonal awareness ──
        const season = detectSeason();
        const isPeak = isPeakWeddingSeason();
        if (shootType === 'wedding' && isPeak) {
            reply += `We're currently in peak wedding season (${season}), so dates are filling quickly. `;
        }
        else if (shootType === 'wedding' && !isPeak) {
            reply += `We're in the ${season} season — a beautiful time for weddings with more date flexibility. `;
        }
        else if (shootType === 'portrait' || shootType === 'child') {
            const seasonTips = {
                spring: 'Spring flowers make a gorgeous backdrop right now! ',
                summer: 'Summer golden hour light is stunning for outdoor sessions. ',
                fall: 'Fall foliage creates the most amazing colors for photos. ',
                winter: 'Winter sessions can be magical with cozy indoor settings. ',
            };
            reply += seasonTips[season] || '';
        }
        if (hasDate) {
            reply += `I'll check my availability — could you share the specific date you have in mind? `;
        }
        else {
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
// Expanded with 30+ genres from international photography community research
export function detectShootType(text) {
    // ── Chinese patterns (QQ/163/126 mailboxes) ──
    if (/周岁|百天|满月|生日.*(拍|照|摄影|写真|聚会|派对|庆祝)/i.test(text) || /(拍|照|摄影).*生日/i.test(text) || /(拍|照|摄影).*(?:周岁|百天|满月)/i.test(text))
        return 'birthday';
    if (/宝宝|婴儿|孩子|儿童|亲子|小孩|宝贝|萌宝/i.test(text))
        return 'child';
    if (/孕妇|孕照|孕期|大肚子|怀孕| maternity /i.test(text))
        return 'maternity';
    if (/婚礼|婚庆|结婚|新娘|新郎|订婚|婚纱/i.test(text))
        return 'wedding';
    if (/写真|个人写真|形象照|肖像/i.test(text))
        return 'portrait';
    if (/活动|年会|开业|庆典|会议|发布会|团建/i.test(text))
        return 'event';
    if (/产品|商品|电商|淘宝|服装|美食|菜品/i.test(text))
        return 'commercial';
    if (/新生儿|刚出生/i.test(text))
        return 'newborn';
    if (/证件照|签证照|护照|驾照|身份证照/i.test(text))
        return 'headshot';
    if (/毕业照|毕业季|学士服|班级合影/i.test(text))
        return 'graduation';
    if (/宠物|狗狗|猫咪|猫狗|主子/i.test(text))
        return 'pet';
    // ── English patterns (international) ──
    // Wedding & Engagement
    if (/wedding|bride|groom|bridal|marriage|ceremony|reception|engagement|proposal|save the date|elopement/i.test(text))
        return 'wedding';
    // Portrait & Headshot
    if (/headshot|head shot|corporate portrait|linkedin photo|professional.*photo|actor.*headshot|model.*portfolio/i.test(text))
        return 'headshot';
    if (/portrait|portraiture|individual.*(?:photo|shoot|session)/i.test(text))
        return 'portrait';
    // Family & Children
    if (/(?:family|families).*(?:photo|shoot|session|picture|portrait)/i.test(text) || /(?:photo|shoot|session).*(?:family|families)/i.test(text))
        return 'child';
    if (/(?:child|kid|toddler|baby|infant|children).*(?:photo|shoot|session|picture|portrait)/i.test(text) || /(?:photo|shoot|session).*(?:child|kid|toddler|baby|infant|children)/i.test(text))
        return 'child';
    // Newborn
    if (/newborn|just born|fresh 48|hospital.*(?:photo|session)|first 48/i.test(text))
        return 'newborn';
    // Maternity
    if (/maternity|pregnant|pregnancy|baby bump|expecting|bump.*(?:photo|shoot|session)/i.test(text))
        return 'maternity';
    // Birthday & Milestone
    if (/birthday|first birthday|cake smash|milestone.*(?:photo|session)/i.test(text))
        return 'birthday';
    // Graduation & Senior
    if (/graduation|senior portrait|senior photo|cap and gown|class of|commencement|senior session/i.test(text))
        return 'graduation';
    // Event & Party
    if (/event|party|gala|conference|celebration|corporate event|holiday party|reunion|bar mitzvah|bat mitzvah|quinceañera|sweet 16/i.test(text))
        return 'event';
    // Concert & Performance
    if (/concert|live music|gig|festival|performance|show|tour|band.*(?:photo|shoot)/i.test(text))
        return 'concert';
    // Sports & Action
    if (/sports|athletic|game|tournament|marathon|race|triathlon|fitness|bodybuilding|competition/i.test(text))
        return 'sports';
    // Commercial & Product
    if (/commercial|product|ecommerce|e-commerce|catalog|advertising|brand.*(?:photo|shoot|content)/i.test(text))
        return 'commercial';
    if (/food.*(?:photo|shoot|photography)|menu|restaurant.*(?:photo|shoot)|culinary/i.test(text))
        return 'food';
    if (/fashion|model|runway|lookbook|editorial.*(?:fashion|style)/i.test(text))
        return 'fashion';
    if (/jewelry|watch.*(?:photo|shoot)|accessor/i.test(text))
        return 'commercial';
    // Real Estate & Architecture
    if (/real estate|property.*(?:photo|shoot)|listing.*photo|home.*(?:photo|shoot).*sell|interior.*(?:photo|shoot)|architecture|airbnb.*(?:photo|shoot)/i.test(text))
        return 'realestate';
    // Pet Photography
    if (/pet.*(?:photo|shoot|session|picture|portrait)|dog.*(?:photo|shoot|session)|cat.*(?:photo|shoot|session)|(?:photo|shoot).*pet/i.test(text))
        return 'pet';
    // Boudoir
    if (/boudoir|intimate.*(?:photo|portrait|session)|empowerment.*(?:photo|shoot)/i.test(text))
        return 'boudoir';
    // Travel & Destination
    if (/destination.*(?:wedding|photo|shoot)|elopement.*(?:photo|shoot)|travel.*(?:photo|shoot)/i.test(text))
        return 'wedding'; // usually wedding-related
    // Drone / Aerial
    if (/drone|aerial.*(?:photo|shoot|footage)|fly.*over.*(?:photo|shoot)/i.test(text))
        return 'aerial';
    // ── New genres from global community research ──
    if (/elopement|micro.?wedding|minimony|tiny wedding|just.*us.*ceremony|tipi.*wedding|festival.*wedding/i.test(text))
        return 'wedding';
    if (/proposal.*(?:photo|shoot|surprise)|surprise.*(?:proposal|engagement)/i.test(text))
        return 'wedding';
    if (/cake smash|milestone.*(?:photo|session)|sitter.*session/i.test(text))
        return 'birthday';
    if (/branding|brand.*(?:photo|shoot|session|content)|personal.*brand/i.test(text))
        return 'commercial';
    if (/lifestyle.*(?:newborn|family|session)|lifestyle.*(?:photo|shoot)/i.test(text))
        return 'child';
    if (/fine.art|artistic.*(?:portrait|photo)|creative.*(?:portrait|shoot)/i.test(text))
        return 'portrait';
    if (/film.*photograph|analog|35mm|medium.format|polaroid/i.test(text))
        return 'portrait';
    if (/destination.*(?:wedding|photo|shoot)|overseas.*(?:wedding|photo)/i.test(text))
        return 'wedding';
    // ── Niche genres from global research ──
    if (/boudoir|intimate.*portrait|empowerment.*(?:session|photo)/i.test(text))
        return 'boudoir';
    if (/twilight.*(?:shoot|photo)|virtual.*(?:tour|staging)|floor.?plan|property.*(?:photo|shoot|listing)|real.estate|airbnb|HDR.*real/i.test(text))
        return 'realestate';
    if (/restaurant.*(?:menu|photo|shoot)|food.*(?:stylist|menu|photo|shoot)|culinary|dish.*(?:photo|shoot)/i.test(text))
        return 'food';
    if (/environmental.*portrait|boardroom|executive.*(?:portrait|headshot)|corporate.*(?:team|group).*(?:photo|portrait|headshot)|B2B.*photo/i.test(text))
        return 'headshot';
    if (/action.*(?:shot|photo).*(?:pet|dog|cat)|(?:pet|dog|cat).*(?:action|running|playing|outdoor).*(?:photo|shoot|session)|senior.*(?:pet|dog|cat)/i.test(text))
        return 'pet';
    // Generic photography interest (last resort)
    if (/photograph|photo|shoot|session|camera|picture|portrait/i.test(text))
        return 'portrait';
    return null;
}
// ── Seasonal awareness (for smarter replies) ──
function detectSeason() {
    const now = new Date();
    const m = now.getMonth(); // 0=Jan, 11=Dec
    if (m >= 2 && m <= 4)
        return 'spring';
    if (m >= 5 && m <= 7)
        return 'summer';
    if (m >= 8 && m <= 10)
        return 'fall';
    return 'winter';
}
function isPeakWeddingSeason() {
    const m = new Date().getMonth();
    return m >= 4 && m <= 9; // May-October = peak wedding season (Northern Hemisphere)
}
export function extractEntities(body, subject) {
    const text = (subject + ' ' + body);
    const entities = [];
    // ── Dates ──
    const datePatterns = [
        // English
        /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*(?:20\d{2})?\b/gi,
        /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
        /\b(?:next|this)\s+(?:week|month|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
        // Chinese
        /\d{4}年\d{1,2}月\d{1,2}[日号]/g,
        /\d{1,2}月\d{1,2}[日号]/g,
        /(?:下|这|本)(?:周|月|星期)/g,
        /(?:明年|今年|明年)\s*\d{1,2}月/g,
    ];
    for (const p of datePatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'date', value: m[0], raw: m[0], confidence: 0.9 });
        }
    }
    // ── Budget / Price ──
    const budgetPatterns = [
        /(?:budget|price|cost|rate|fee|pricing|quote|estimate).{0,30}?\$?\s?(\d[\d,.]*)\s*(?:k|千|万)?/gi,
        /\$\s?(\d[\d,.]*)\s*(?:k|thousand)?\s*(?:budget|price|cost|range|minimum|starting)?/gi,
        /(?:budget|price|cost|rate).{0,20}?(\d[\d,.]*)\s*[百千万]?/gi,
        /(?:预算|价格|费用|报价|收费|多少钱).{0,20}?(\d[\d,.]*)\s*[百千万]?/g,
    ];
    for (const p of budgetPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'budget', value: m[0].trim(), raw: m[0], confidence: 0.8 });
        }
    }
    // ── Location / Venue ──
    const locPatterns = [
        /(?:venue|location|place|where|at)\s+(?:is|:)?\s*([A-Z][\w\s&.']+(?:Gardens|Hotel|Resort|Manor|Hall|Beach|Park|Church|Chapel|Estate|Vineyard|Barn|Mansion|Club|Restaurant|Studio|Farm))/gi,
        /(?:地点|在哪|位置|酒店|场地|场所)[：:]\s*(.{2,30})/g,
        /(?:venue|location)[：:]\s*(.{2,40})/gi,
        /(?:at|in)\s+(?:the\s+)?([A-Z][\w\s]+(?:Gardens|Hotel|Resort|Manor|Hall|Beach|Park))\b/gi,
    ];
    for (const p of locPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'location', value: (m[1] || m[0]).trim(), raw: m[0], confidence: 0.75 });
        }
    }
    // ── Guest Count ──
    const guestPatterns = [
        /(\d{2,4})\s*(?:guests|people|persons|attendees|invited|coming)/gi,
        /(?:guest|attendee|people|person)\s*(?:count|number|list).{0,20}?(\d{2,4})/gi,
        /(\d{2,4})\s*(?:位|人|名).{0,10}?(?:嘉宾|客人|宾客|来宾)/g,
    ];
    for (const p of guestPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            const num = parseInt((m[1] || m[0]).replace(/\D/g, ''));
            if (num >= 2 && num <= 9999) {
                entities.push({ type: 'guest_count', value: String(num), raw: m[0], confidence: 0.85 });
            }
        }
    }
    // ── Coverage Hours ──
    const hoursPatterns = [
        /(\d{1,2})\s*(?:hours?|hrs?|h)\s*(?:of\s*)?(?:coverage|shooting|photography)/gi,
        /(?:coverage|shoot|photography).{0,20}?(\d{1,2})\s*(?:hours?|hrs?)/gi,
        /(?:full|half)\s*day/gi,
        /(\d{1,2})\s*(?:小时|个?钟头)/g,
        /(?:全天|全天候|半天)/g,
    ];
    for (const p of hoursPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'hours', value: m[0].trim(), raw: m[0], confidence: 0.8 });
        }
    }
    // ── Requirements / Special Requests ──
    const reqPatterns = [
        /(?:need|want|looking for|require|must have|would like).{0,40}?(?:second (?:shooter|photographer)|album|print|drone|video|film|engagement|candid|formal|black.?white)/gi,
        /(?:需要|想要|必须|一定).{0,20}?(?:双机|相册|打印|无人机|视频|底片|精修|修图|美颜)/g,
        /(?:specific|special|custom|particular).{0,20}?(?:request|requirement|need|style)/gi,
    ];
    for (const p of reqPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'requirement', value: m[0].trim(), raw: m[0], confidence: 0.7 });
        }
    }
    // ── Change Detection ──
    const changePatterns = [
        /(?:changed|updated|moved|rescheduled|postponed|new).{0,30}?(?:date|time|venue|location|budget|plan)/gi,
        /(?:改|换|调整|修改|更新|变动).{0,15}?(?:日期|时间|地点|预算|计划|方案)/g,
        /(?:instead of|rather than|not).{0,30}?(?:date|venue|location)/gi,
        /(?:sorry|unfortunately|regret).{0,40}?(?:can'?t|cannot|won'?t|unable|change|cancel)/gi,
    ];
    for (const p of changePatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'change', value: m[0].trim(), raw: m[0], confidence: 0.7 });
        }
    }
    // ── Urgent signals ──
    const urgentPatterns = [
        /(?:as soon as possible|ASAP|urgent|emergency|immediately|right away| today | tomorrow )/gi,
        /(?:尽快|马上|紧急|急|立刻|立即)/g,
        /(?:deadline|due date).{0,20}?(?:\d|today|tomorrow|next)/gi,
        /\b(?:today|tomorrow)\b.{0,20}?\?/gi,
    ];
    for (const p of urgentPatterns) {
        let m;
        while ((m = p.exec(text)) !== null) {
            entities.push({ type: 'urgency', value: m[0].trim(), raw: m[0], confidence: 0.9 });
        }
    }
    // ── Questions (client expects an answer) ──
    if (/\?/.test(text)) {
        const questionMatches = text.match(/[^.!?\n]+\?/g);
        if (questionMatches) {
            for (const q of questionMatches.slice(0, 3)) {
                if (q.trim().length > 10) {
                    entities.push({ type: 'question', value: q.trim(), raw: q, confidence: 0.95 });
                }
            }
        }
    }
    // Deduplicate by value
    const seen = new Set();
    return entities.filter(e => {
        const key = `${e.type}:${e.value.slice(0, 50)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
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
