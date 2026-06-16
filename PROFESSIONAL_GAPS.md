# StudioSage 专业公司视角缺失项

> 2026-06-16

---

## 一、已有基础（14 个 API 模块，12 个页面）

| 模块 | API | 前端 |
|---|---|---|
| 认证 | register/login/me | Login, Register |
| 面板 | dashboard + SSE stream | Dashboard |
| 客户 | CRUD + 统计 | Clients |
| 消息 | inbox/stats/incoming/send/reply | Inbox(废弃) |
| 提案 | CRUD + share + AI生成 | Proposals |
| 发票 | CRUD + generate + send + PDF | Invoices |
| 日历 | events/check/appointments/shoots | Calendar |
| 邮件 | config/detect/test/connect/disconnect | Connect |
| 门户 | proposal/messages/invoices(客户侧) | PortalProposal |
| 画廊 | list/client/link | ❌ 无前端 |
| 设置 | status + auto-reply | Settings |
| Webhook | Stripe + Pixieset | — |
| 引导 | — | Onboarding |

---

## 二、专业公司缺失项

### 🔴 P0 — 无此不能上线

| # | 缺失项 | 影响 |
|---|---|---|
| 1 | **密码重置** | 用户忘记密码只能重新注册 |
| 2 | **账单/订阅管理** | 无法收费，没有 Stripe Customer Portal |
| 3 | **服务条款 + 隐私政策** | 法律风险，GDPR不合规 |
| 4 | **数据备份验证** | 有备份机制但从未验证恢复流程 |
| 5 | **错误监控** | 无 Sentry/Datadog，线上报错不知道 |

### 🟡 P1 — 严重影响体验

| # | 缺失项 | 影响 |
|---|---|---|
| 6 | **欢迎邮件** | 注册后无任何 onboarding 邮件 |
| 7 | **邮件通知** | 新消息/发票支付无邮件提醒 |
| 8 | **客户搜索** | 客户多了找不到 |
| 9 | **消息搜索** | 聊天记录多了翻不到 |
| 10 | **客户时间线** | 看不到完整交互历史 |
| 11 | **发票列表分页** | 数据多了加载慢 |
| 12 | **客户导入/导出** | 无法从旧系统迁移 |
| 13 | **个人头像** | 没有头像上传 |
| 14 | **移动端适配** | 手机打开布局乱 |

### 🟢 P2 — 竞争力差距

| # | 缺失项 | 影响 |
|---|---|---|
| 15 | **业务分析面板** | 收入趋势/转化率/季节性 |
| 16 | **团队协作** | 多用户+权限管理 |
| 17 | **白标** | 自定义域名+品牌 |
| 18 | **API 文档** | 无 OpenAPI/Swagger |
| 19 | **集成市场** | QuickBooks/Calendly/Zapier |
| 20 | **多语言邮件模板** | AI 回复只有英文 |
| 21 | **A/B 测试** | 不知道哪个功能好用 |
| 22 | **客户满意度(NPS)** | 无反馈收集 |

### ⚪ P3 — 锦上添花

| # | 缺失项 |
|---|---|
| 23 | 暗色模式 |
| 24 | 键盘快捷键 |
| 25 | 批量操作(群发/批量开发票) |
| 26 | 客户标签/分组 |
| 27 | 自动化规则(if-this-then-that) |
| 28 | 录音转文字(咨询电话) |

---

## 三、本周可做的 3 件事

### 1. 密码重置（2小时）

```
POST /api/auth/forgot-password  → 发送重置链接到邮箱
POST /api/auth/reset-password   → 验证token + 更新密码
新增 ForgotPassword.tsx 页面
```

### 2. 客户搜索（1小时）

```
GET /api/clients?search=xxx → 模糊搜索name/email
前端 Clients 页面添加搜索框
```

### 3. 服务条款页面（30分钟）

```
新增 TermsOfService.tsx + PrivacyPolicy.tsx
Login/Register 页面底部添加链接
```

---

## 四、对比竞品

| 功能 | HoneyBook | Dubsado | Sprout | **我们** |
|---|---|---|---|---|
| 密码重置 | ✅ | ✅ | ✅ | ❌ |
| 订阅管理 | ✅ | ✅ | ✅ | ❌ |
| 移动端 | ✅ App | ❌ | ✅ App | ❌ |
| 客户搜索 | ✅ | ✅ | ✅ | ❌ |
| 业务分析 | ✅ | ❌ | ✅ | ❌ |
| 团队协作 | ✅ | ✅ | ❌ | ❌ |
| 集成市场 | ✅ Zapier | ✅ | ❌ | ❌ |
| API 文档 | ❌ | ❌ | ❌ | ❌ |
| 白标 | ✅ | ✅ | ✅ | ❌ |

**差距**: 竞品有的基础功能（密码重置/订阅/搜索/移动端）我们都缺。竞品没有的（AI全管线/IMAP全覆盖）我们有。

---

## 五、推荐优先级

```
这周: 密码重置 + 客户搜索 + 服务条款
下周: Stripe订阅 + 欢迎邮件 + 邮件通知
本月: 移动端适配 + 客户时间线 + 消息搜索
```
