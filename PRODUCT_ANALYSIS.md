# StudioSage 竞品对标分析 & 产品问题清单

> 2026-06-15 · 完整代码审查

---

## 一、竞品矩阵

| 维度 | HoneyBook | Dubsado | Studio Ninja | Sprout Studio | **我们** |
|---|---|---|---|---|---|
| 价格/月 | $29-109 | $25-45 | $25-45 | $39-65 | **$10（目标）** |
| AI 自动分类回复 | ⚠️ 模板化 | ❌ | ❌ | ❌ | ✅ DeepSeek |
| 邮件集成 | Gmail | Gmail | Gmail | Gmail | ✅ IMAP全覆盖 |
| 提案/合同 | ✅ 核心 | ✅ 核心 | ✅ | ❌ | ❌ |
| 发票+在线收款 | ✅ Stripe | ✅ | ✅ | ✅ | ⚠️ 后端有，前端无 |
| 客户门户 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 日历排期 | ✅ | ✅ | ✅ | ❌ | ⚠️ API有，无UI |
| 画廊集成 | ❌ | ❌ | ❌ | ✅ 自带 | ⚠️ Pixieset只读 |
| 多渠道(微信/SMS) | ❌ | ❌ | ❌ | ❌ | ✅ Schema就绪 |
| 中文支持 | ❌ | ❌ | ❌ | ❌ | ✅ 原生 |
| 离线降级 | ❌ | ❌ | ❌ | ❌ | ✅ 规则引擎 |

---

## 二、强项

1. **AI 碾压** — 全线 DEA: IMAP收件 → DeepSeek分类 → 自动草稿 → 一键发送。竞品没有完整的 AI 管线
2. **邮箱策略更开放** — Gmail/Outlook/Yahoo/QQ/163/126/阿里 + 自定义IMAP。竞品基本只做 Gmail OAuth
3. **价格 3-10x 优势** — $10/月 vs HoneyBook $109/月
4. **多渠道基础架构** — messages 表已预留 channel 字段(email/wechat/sms/instagram/whatsapp)
5. **中文+国际双轨** — 国内摄影师市场没有竞品

---

## 三、P0 缺失功能

### 1. 提案/合同构建器 ❌
HoneyBook 和 Dubsado 核心卖点。摄影师需要给客户发套餐+价格+合同。这是从"咨询"到"预定"的唯一桥梁。

### 2. 客户自助门户 ❌
Dubsado/Sprout Studio 客户可查看消息、下载文件、支付发票。我们只有摄影师内部视图。

### 3. 发票→收款闭环断链 ❌
后端 StripeAdapter 写好了，前端根本没接。创建了发票拿不到支付链接。

### 4. 用户认证 ❌
`user_id` 全写死 `'default'`。没有登录、没有多租户。

### 5. 生产数据库 ❌
sql.js(内存SQLite) 不适合生产：崩溃丢数据、并发不安全、内存膨胀。

---

## 四、P1 体验缺口

- 日历/排期有 Google Calendar API 但前端无排期页面
- 移动端不存在(PWA 插件装了但没配 manifest)
- Pixieset 集成只读，不能创建画廊/上传照片
- 通知开关是假开关（纯前端 state，没有后端推送）
- Dashboard 写死 "Emma"，无团队协作
- 发票 PDF 是空壳（`GET /api/invoices/:id/pdf` 只返回字符串）
- 错误处理不统一（有的返回 `{error}`，有的返回 `{ok:false, error}`）
- 列表接口无分页（LIMIT 50 硬编码）

---

## 五、技术债

- sql.js 需迁移 better-sqlite3 或 PostgreSQL
- 零测试覆盖（vitest 骨架存在，无任何测试用例）
- email-connect 密码明文存 DB
- 所有 API 无鉴权
- 无日志系统、无监控告警
- 11 个 TypeScript 隐式 any 错误（adapters/email.ts）
- 前后端通信无 proxy 配置

---

## 六、用户旅程断点（Emma 的完整 booking → delivery）

```
登录 → 连接邮箱 → 收咨询 → AI分类草稿 → 回复 → 客户确认 → 
发提案/合同 → 签约 → 排拍日期 → 拍摄 → 上传画廊 → 客户查看 → 
开发票 → 客户付款 → 交付 → 收好评
```

**7 个断点：**
- 登录（无认证）
- 发提案/合同（完全缺失）
- 排日期（API 有，无 UI）
- 上传画廊（Pixieset 只读）
- 开发票（后端有，前端无 UI 流程）
- 客户付款（无 Stripe 支付链接）
- 交付/好评（无流程）

---

## 七、建议优先级

```
P0 (现在)：
  1. 提案/报价构建器（booking 闭环的关键桥梁）
  2. 发票→Stripe 支付链接（变现通道）
  3. 用户认证（多租户基础）

P1 (两周)：
  4. 合同模板
  5. 客户自助门户 MVP
  6. 日历排期 UI
  7. better-sqlite3 迁移

P2 (一个月)：
  8. 画廊深度集成
  9. 业务分析/报表
  10. PWA 移动端
  11. 微信渠道消息接入
```

---

## 八、项目结构速览

```
server/
  src/
    adapters/     — Stripe, Gmail, Pixieset, Google Calendar, Email(IMAP)
    ai/           — engine.ts (DeepSeek/Claude API) + rules-engine.ts (离线)
    api/          — dashboard, clients, messages, invoices, settings, email-connect, oauth, webhooks
    db/           — schema.ts (sql.js) + query.ts
    middleware/   — error-handler, security, validate
    workers/      — email-watcher.ts (60s轮询IMAP)
  package.json   — express, sql.js, imap, nodemailer, googleapis, dotenv, helmet
client/
  src/
    pages/       — Dashboard, Clients, Connect, Settings, Onboarding, Inbox, Invoices
    components/  — Layout, ErrorBoundary, Skeleton, ConnectButtons
  package.json   — React 18, Vite 5, React Router 6, Tailwind 3, PWA
```
