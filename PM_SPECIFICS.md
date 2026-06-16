# StudioSage 具体执行计划

> 2026-06-16 · 可落地的下一步

---

## 一、当前代码规模

```
56 个源文件
~8500 行 TypeScript
12 个 API 路由模块
9 个前端页面
0 个测试用例
```

## 二、立即要修的 3 个 Bug（今天）

| # | Bug | 文件 | 工作量 |
|---|---|---|---|
| 1 | Invoices.tsx 仍有中文 toast 消息 | `client/src/pages/Invoices.tsx` 多处 `toast('xxx')` | 30分钟 |
| 2 | Inbox.tsx 整页中文（虽已重定向，代码仍在） | `client/src/pages/Inbox.tsx` | 15分钟 |
| 3 | Connect.tsx OAuth/AuthCode/Password 步骤中文硬编码 | `client/src/pages/Connect.tsx:166-278` | 45分钟 |

## 三、Phase 1：可收费 MVP（5 个任务，预计 2 周）

### Task 1：Stripe 真实支付端到端（3 天）

**当前状态**：`STRIPE_SECRET_KEY=sk_test_placeholder`，发票发送时返回 "Stripe 未配置"。

**需要做的**：
1. 申请 Stripe 测试 key（`sk_test_xxx`）
2. 配置 `STRIPE_WEBHOOK_SECRET`
3. 本地运行 `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
4. 完整走通：创建发票 → 发送 → 打开支付链接 → 输入测试卡号 `4242 4242 4242 4242` → 支付成功 → webhook 更新 status=paid → 面板显示已收
5. 测试失败场景：卡被拒 → webhook 更新 status=overdue
6. 测试 PDF 发票包含支付确认

**验收标准**：用测试卡完成一次完整支付，DB 中 invoice.status 从 draft→sent→paid。

### Task 2：日历排期 UI（3 天）

**当前状态**：`/api/calendar/events` 和 `/api/calendar/check` 和 `/api/calendar/appointments` 三个端点已就绪，但前端零 UI。

**需要做的**：
1. 新建 `client/src/pages/Calendar.tsx`
2. 功能：月视图日历 + 点击日期查看可用时段 + 创建预约
3. 关联客户：创建预约时可选择已有客户
4. 同步 Google Calendar（如已连接）
5. App.tsx 添加路由 `/calendar`
6. Layout 底部导航添加日历图标

**验收标准**：日历上能看到预约、点击空白日期能创建新预约、创建后关联到客户卡片。

### Task 3：核心 API 集成测试（2 天）

**当前状态**：`vitest` 已安装，零测试用例。

**需要覆盖的 10 个测试**：
```typescript
// auth.test.ts
test('POST /api/auth/register → 201 + token')
test('POST /api/auth/login → 200 + token')
test('POST /api/auth/register 重复邮箱 → 409')
test('GET /api/auth/me 无token → 401')

// invoices.test.ts
test('POST /api/invoices/generate → 201 + invoice')
test('POST /api/invoices/:id/send → Stripe key无效时返回400')
test('GET /api/invoices → 200 + array')

// proposals.test.ts
test('POST /api/proposals → 201 + shareToken')
test('GET /api/portal/proposal/:token → 200 + proposal')
test('POST /api/portal/proposal/:token/accept → client.stage=booked')
```

**验收标准**：`npx vitest run` 10/10 通过。

### Task 4：better-sqlite3 迁移（2 天）

**当前状态**：sql.js 内存数据库，进程重启数据丢、并发不安全、内存膨胀。

**迁移步骤**：
1. `pnpm add better-sqlite3 @types/better-sqlite3`
2. 改 `db/schema.ts`：`new Database(DB_PATH)` 替换 sql.js 初始化
3. 改 `db/query.ts`：`db.prepare(sql).all(params)` 替换 sql.js API
4. 删 `markDirty/saveDb/closeDb` — better-sqlite3 自动持久化
5. 删 `_periodicTimer/_saveTimer` — 不需要
6. 删 `_setupShutdownHooks` — 不需要
7. 运行测试确认所有 API 正常

**对比**：
| 维度 | sql.js | better-sqlite3 |
|---|---|---|
| 持久化 | 手动导出到文件 | 自动写入磁盘 |
| 并发 | 单线程不安全 | 支持多连接 |
| 内存 | 全库加载到内存 | 按需读取 |
| 崩溃恢复 | 丢数据 | WAL 日志恢复 |

**验收标准**：重启服务器后数据不丢失，所有 API 正常。

### Task 5：编辑个人资料（1 天）

**当前状态**：注册后无法修改名字/邮箱/密码。

**需要做的**：
1. `PATCH /api/auth/profile` — 修改 name/email
2. `POST /api/auth/change-password` — 修改密码（需验证旧密码）
3. Settings 页面添加 Profile 区块（名字输入框 + 邮箱输入框 + 修改密码按钮）

**验收标准**：Settings 页面可修改名字和密码。

---

## 四、Phase 2：有竞争力（5 个任务，预计 4 周）

### Task 6：合同电子签署
- 集成 HelloSign API 或简单的"勾选同意+输入姓名"签名
- 提案→客户接受→自动生成合同→客户签署→PDF归档

### Task 7：客户时间线
- 新建 `client_timeline` 表
- 消息/提案/发票事件自动记录
- 客户详情页增加垂直时间线组件

### Task 8：移动端基础适配
- Tailwind 响应式断点
- 底部导航在手机上使用 `fixed bottom-0`
- 表单输入框适配小屏幕

### Task 9：全文搜索
- `GET /api/search?q=xxx` 端点
- 搜索客户名、邮件主题、邮件正文
- 搜索结果页

### Task 10：数据导出
- `GET /api/export/clients` → CSV
- `GET /api/export/invoices` → CSV
- 设置页面添加导出按钮

---

## 五、定价与收入模型

### 具体数字

**目标用户画像**：美国独立婚礼摄影师，年拍摄 30 场婚礼，平均客单 $3,500。

**获客成本**：
- Google Ads：婚礼摄影关键词 CPC $3-8，转化率 2% → CAC $150-400
- Instagram 广告：CPM $6-10，转化率 1% → CAC $200-500
- 内容营销（博客/YouTube）：CAC $50-100（慢但可持续）
- Product Hunt 发布：免费，预计 200-500 注册

**定价对比**：
| | StudioSage | HoneyBook | Dubsado | Sprout Studio |
|---|---|---|---|---|
| 起步价 | **$10** | $29 | $25 | $39 |
| 中间档 | **$25** | $49 | $40 | $51 |
| 高级档 | **$49** | $109 | $55 | — |
| AI 自动回复 | ✅ 全管线 | ⚠️ 文案辅助 | ❌ | ⚠️ 模板 |

**收入预测（保守）**：
| 月份 | 用户数 | 付费率 | MRR |
|---|---|---|---|
| 第1月 | 200 | 5% | $100 |
| 第3月 | 500 | 8% | $1,000 |
| 第6月 | 1,500 | 10% | $3,750 |
| 第12月 | 5,000 | 12% | $15,000 |

---

## 六、技术债清理计划

| 项目 | 现状 | 目标 | 工期 |
|---|---|---|---|
| 数据库 | sql.js 内存 | better-sqlite3 持久化 | 2天 |
| 测试 | 0 用例 | 10 核心集成测试 | 2天 |
| 错误格式 | 混用 `{error}` / `{ok,error}` | 统一 `{ok, error}` | 1天 |
| i18n 遗漏 | Invoices/Settings/Inbox/Connect 有中文 | 全英文+i18n | 2天 |
| 日志系统 | console.log 散落 | 结构化 logger | 1天 |
| TypeScript 严格 | `strict: false` | `strict: true` + 修类型 | 2天 |

---

## 七、下一步行动清单

```
今天：
[x] 产品分析报告
[ ] 修复 Invoices/Inbox/Connect 中文硬编码

本周：
[ ] Stripe 真实支付测试
[ ] 日历 UI
[ ] 核心 API 集成测试

下周：
[ ] better-sqlite3 迁移
[ ] 编辑个人资料
[ ] 找 5 个摄影师朋友试用

两周后：
[ ] 收集反馈
[ ] 修反馈中的 Bug
[ ] 决定是否公开发布
```
