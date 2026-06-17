# StudioSage 上线路径 — 从代码到收钱

## 依赖链分析

```
能收钱 ← Stripe订阅 ← 付费墙 ← 注册/登录 ← 部署 ← PG迁移 ← 文件存储R2
                                                    ↑
                                              落地页/官网
```

## Phase 1：能收钱（上线日）

### 1.1 生产部署
- Docker 化 server + client
- Railway 或 Hetzner VPS（月费 $5-20）
- Cloudflare DNS + SSL
- 环境变量管理（API keys、Stripe 密钥等）

### 1.2 数据库迁移 SQLite → PostgreSQL
- Prisma 或 Drizzle ORM（替代手写 SQL，支持 PG）
- 迁移现有 7+4 张表
- 数据备份策略

### 1.3 文件存储迁移 → Cloudflare R2
- 上传改为 R2 presigned URL
- 缩略图生成保持在 server（sharp），结果上传到 R2
- 费用：R2 免费 10GB 存储，够百人用

### 1.4 Stripe 订阅
- 三个 Plan：Free / Pro $12 / Studio $29
- Stripe Checkout 集成
- Webhook 处理订阅状态变更

### 1.5 付费墙
- Free tier 限额：1 活跃项目 + 100 张照片
- 超额提示升级
- Pro/Studio 无限制

### 1.6 落地页
- 单页：是什么、解决什么痛、价格、CTA
- studiosage.ge

**Phase 1 完成 = 能收钱**

---

## Phase 2：能运营（上线后 1-2 周）

### 2.1 Admin 后台
- 用户列表 + 套餐状态
- 用量统计
- 密码重置（人工）
- 系统健康监控

### 2.2 计量计费
- AI API 调用量追踪
- 超额提醒/限制
- 用量仪表盘

### 2.3 用户引导
- 注册后 3 步引导
- 模板项目（Demo 数据）
- "创建第一个项目" → "上传第一批样片" → "发送选片链接"

---

## Phase 3：能增长（上线后 1 个月）

- 邀请制裂变（摄影师分享链接给客户 = 免费获客）
- Reddit/小红书内容营销
- 合作伙伴（摄影器材商、修图师社群）

---

## 不做清单

| 项目 | 原因 |
|------|------|
| Tauri 桌面应用 | 无用户需求验证 |
| 微信小程序客户选片 | 移动网页已够用，小程序审核周期长 |
| 多语言 | 先英文市场，中文后加 |
| 团队协作 | Studio tier 有，但先不做 |
| 摄影师收款/提现 | 我们是 SaaS，不是 marketplace |
