// Universal IMAP email adapter — supports Gmail, 163, QQ, Outlook, Yahoo, custom
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

export interface EmailConfig {
  email: string;
  password: string; // app-specific password / authorization code
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
}

// Provider auto-detection map
const PROVIDER_CONFIG: Record<string, EmailConfig> = {
  'gmail.com':       { email:'', password:'', imapHost:'imap.gmail.com',    imapPort:993,  imapTls:true,  smtpHost:'smtp.gmail.com',    smtpPort:465, smtpTls:true },
  'googlemail.com':  { email:'', password:'', imapHost:'imap.gmail.com',    imapPort:993,  imapTls:true,  smtpHost:'smtp.gmail.com',    smtpPort:465, smtpTls:true },
  'outlook.com':     { email:'', password:'', imapHost:'outlook.office365.com', imapPort:993, imapTls:true, smtpHost:'smtp.office365.com', smtpPort:587, smtpTls:false },
  'hotmail.com':     { email:'', password:'', imapHost:'outlook.office365.com', imapPort:993, imapTls:true, smtpHost:'smtp.office365.com', smtpPort:587, smtpTls:false },
  'live.com':        { email:'', password:'', imapHost:'outlook.office365.com', imapPort:993, imapTls:true, smtpHost:'smtp.office365.com', smtpPort:587, smtpTls:false },
  'yahoo.com':       { email:'', password:'', imapHost:'imap.mail.yahoo.com', imapPort:993, imapTls:true,  smtpHost:'smtp.mail.yahoo.com', smtpPort:465, smtpTls:true },
  '163.com':         { email:'', password:'', imapHost:'imap.163.com',      imapPort:993,  imapTls:true,  smtpHost:'smtp.163.com',       smtpPort:465, smtpTls:true },
  '126.com':         { email:'', password:'', imapHost:'imap.126.com',      imapPort:993,  imapTls:true,  smtpHost:'smtp.126.com',       smtpPort:465, smtpTls:true },
  'yeah.net':        { email:'', password:'', imapHost:'imap.yeah.net',     imapPort:993,  imapTls:true,  smtpHost:'smtp.yeah.net',      smtpPort:465, smtpTls:true },
  'qq.com':          { email:'', password:'', imapHost:'imap.qq.com',       imapPort:993,  imapTls:true,  smtpHost:'smtp.qq.com',        smtpPort:465, smtpTls:true },
  'foxmail.com':     { email:'', password:'', imapHost:'imap.qq.com',       imapPort:993,  imapTls:true,  smtpHost:'smtp.qq.com',        smtpPort:465, smtpTls:true },
  'aliyun.com':      { email:'', password:'', imapHost:'imap.aliyun.com',   imapPort:993,  imapTls:true,  smtpHost:'smtp.aliyun.com',    smtpPort:465, smtpTls:true },
};

export interface ProviderInfo {
  key: string;
  name: string;
  helpUrl: string;
  setupGuide: string;
  needsAppPassword: boolean;
  oauthAvailable: boolean;
}

const PROVIDER_HELP: Record<string, ProviderInfo> = {
  'gmail.com':       { key:'gmail',    name:'Gmail',         helpUrl:'https://myaccount.google.com/apppasswords', setupGuide:'1. 打开 Google 账号设置\n2. 点击「安全性」→「两步验证」→ 开启\n3. 搜索「应用专用密码」→ 生成\n4. 选择「邮件」+「其他」→ 复制 16 位密码', needsAppPassword:true, oauthAvailable:true },
  'outlook.com':     { key:'outlook',  name:'Outlook/Hotmail', helpUrl:'https://account.microsoft.com/security', setupGuide:'1. 打开 Microsoft 账户安全页\n2. 点击「高级安全性选项」\n3. 找到「应用密码」→ 创建\n4. 复制生成的密码', needsAppPassword:true, oauthAvailable:true },
  'yahoo.com':       { key:'yahoo',    name:'Yahoo Mail',    helpUrl:'https://login.yahoo.com/account/security', setupGuide:'1. 打开 Yahoo 账户安全\n2. 点击「生成应用密码」\n3. 选择「其他应用」\n4. 复制生成的密码', needsAppPassword:true, oauthAvailable:false },
  '163.com':         { key:'163',      name:'网易 163 邮箱',  helpUrl:'https://mail.163.com/', setupGuide:'1. 用电脑打开 mail.163.com 并登录\n2. 点击顶部「设置」→「POP3/SMTP/IMAP」\n3. 勾选「开启 IMAP 服务」\n4. 点击「新增授权码」→ 手机验证\n5. 复制生成的授权码（如：ABCDEFGHIJKLMNOP）', needsAppPassword:true, oauthAvailable:false },
  '126.com':         { key:'126',      name:'网易 126 邮箱',  helpUrl:'https://mail.126.com/', setupGuide:'1. 用电脑打开 mail.126.com 并登录\n2. 点击顶部「设置」→「POP3/SMTP/IMAP」\n3. 勾选「开启 IMAP 服务」\n4. 点击「新增授权码」→ 手机验证\n5. 复制生成的授权码（如：ABCDEFGHIJKLMNOP）', needsAppPassword:true, oauthAvailable:false },
  'yeah.net':        { key:'yeah',     name:'网易 Yeah 邮箱', helpUrl:'https://mail.yeah.net/', setupGuide:'1. 用电脑打开 mail.yeah.net 并登录\n2. 点击「设置」→「POP3/SMTP/IMAP」\n3. 开启 IMAP → 新增授权码\n4. 复制生成的授权码', needsAppPassword:true, oauthAvailable:false },
  'qq.com':          { key:'qq',       name:'QQ 邮箱',       helpUrl:'https://mail.qq.com/', setupGuide:'1. 用电脑浏览器打开 mail.qq.com 并登录\n2. 点击顶部「设置」按钮\n3. 切换到「账户」标签页\n4. 往下滚动找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」\n5. 点击 IMAP/SMTP 服务 后面的「开启」按钮\n6. 按提示用密保手机发送短信验证\n7. 验证成功后会出现 16 位授权码，复制它', needsAppPassword:true, oauthAvailable:false },
  'foxmail.com':     { key:'foxmail',  name:'Foxmail',       helpUrl:'https://mail.qq.com/', setupGuide:'Foxmail 使用 QQ 邮箱的授权码\n1. 用电脑打开 mail.qq.com 登录 Foxmail 账号\n2. 设置 → 账户 → IMAP/SMTP 服务 → 开启\n3. 短信验证后获取 16 位授权码', needsAppPassword:true, oauthAvailable:false },
  'aliyun.com':      { key:'aliyun',   name:'阿里云邮箱',     helpUrl:'https://mail.aliyun.com/', setupGuide:'1. 电脑登录 mail.aliyun.com\n2. 点击右上角齿轮图标「设置」\n3. 点击「POP 和 IMAP 设置」\n4. 开启 IMAP 并设置客户端密码\n5. 复制客户端密码', needsAppPassword:true, oauthAvailable:false },
};

const DEFAULT_CONFIG: EmailConfig = {
  email:'', password:'', imapHost:'', imapPort:993, imapTls:true, smtpHost:'', smtpPort:465, smtpTls:true,
};

/** Detect email provider from address */
export function detectProvider(email: string): { config: EmailConfig; info: ProviderInfo | null } {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const config = { ...(PROVIDER_CONFIG[domain] || DEFAULT_CONFIG), email };
  const info = PROVIDER_HELP[domain] || null;
  // Custom provider
  if (!info) {
    return {
      config,
      info: { key:'custom', name:`${domain} (手动配置)`, helpUrl:'', setupGuide:'', needsAppPassword:true, oauthAvailable:false },
    };
  }
  return { config, info };
}

/** Test IMAP + SMTP connection. Returns detailed error info */
export async function testConnection(cfg: EmailConfig): Promise<{ ok: boolean; error?: string; authFailed?: boolean }> {
  // Test IMAP
  try {
    await new Promise<void>((resolve, reject) => {
      const imap = new Imap({
        user: cfg.email, password: cfg.password,
        host: cfg.imapHost, port: cfg.imapPort, tls: cfg.imapTls,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000, authTimeout: 10000,
      });
      const timer = setTimeout(() => { imap.destroy(); reject(new Error('IMAP 连接超时')); }, 12000);
      imap.once('ready', () => { clearTimeout(timer); imap.end(); resolve(); });
      imap.once('error', (err: Error) => {
        clearTimeout(timer);
        const msg = err.message || '';
        if (/auth|login|password|credential|535|authentication failed/i.test(msg)) {
          reject(Object.assign(err, { authFailed: true }));
        } else {
          reject(err);
        }
      });
      imap.connect();
    });
  } catch (err: any) {
    if (err.authFailed) return { ok: false, authFailed: true, error: '邮箱密码不正确，请重试' };
    if (err.message?.includes('超时')) return { ok: false, error: '连接超时，请检查网络或服务器地址' };
    return { ok: false, error: `IMAP 连接失败: ${err.message}` };
  }

  // Test SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpTls,
      auth: { user: cfg.email, pass: cfg.password },
      connectionTimeout: 10000,
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();
  } catch (err: any) {
    if (/auth|login|password|535/.test(err.message || '')) {
      return { ok: false, authFailed: true, error: '邮箱密码不正确，请重试' };
    }
    return { ok: false, error: `SMTP 连接失败: ${err.message}` };
  }

  return { ok: true };
}

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  snippet: string;
  date: Date;
}

/** Fetch recent inbox messages */
export async function fetchRecentMessages(cfg: EmailConfig, limit = 10): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: cfg.email, password: cfg.password,
      host: cfg.imapHost, port: cfg.imapPort, tls: cfg.imapTls,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
    });

    const messages: EmailMessage[] = [];
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err: Error) => {
        if (err) { imap.end(); return reject(err); }
        imap.search(['ALL'], (err: Error | null, results: number[]) => {
          if (err || !results.length) { imap.end(); return resolve([]); }
          const latest = results.slice(-limit);
          const fetch = imap.fetch(latest, { bodies: '', struct: true });
          fetch.on('message', (msg: Imap.ImapMessage) => {
            let body = '';
            msg.on('body', (stream: NodeJS.ReadableStream) => { stream.on('data', (chunk: Buffer) => body += chunk.toString('utf8')); });
            msg.once('attributes', (attrs: Record<string, unknown>) => {
              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(body);
                  messages.push({
                    id: attrs.uid?.toString() || '',
                    from: parsed.from?.text || '',
                    subject: parsed.subject || '',
                    body: parsed.text || parsed.html || '',
                    snippet: parsed.text?.slice(0, 200) || '',
                    date: parsed.date || new Date(),
                  });
                } catch { /* skip parse errors */ }
              });
            });
          });
          fetch.once('error', (err: Error) => reject(err));
          fetch.once('end', () => { imap.end(); resolve(messages); });
        });
      });
    });
    imap.once('error', (err: Error) => reject(err));
    imap.connect();
  });
}

/** Send a reply */
export async function sendReply(cfg: EmailConfig, to: string, subject: string, body: string, inReplyTo?: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpTls,
    auth: { user: cfg.email, pass: cfg.password },
    tls: { rejectUnauthorized: false },
  });
  await transporter.sendMail({
    from: cfg.email,
    to,
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    text: body,
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  });
}
