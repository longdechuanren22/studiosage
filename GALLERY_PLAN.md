# 画廊模块部署方案

> 2026-06-16

---

## 结论：不自己造画廊，深度集成 Pixieset

### 为什么不自己造

| 维度 | 自建 | 集成 Pixieset |
|---|---|---|
| 开发周期 | 3-6个月 | 1-2周 |
| CDN/存储 | 需要 AWS S3 + CloudFront | Pixieset 已解决 |
| 水印/防盗 | 需要图片处理管线 | Pixieset 已解决 |
| 打印下单 | 需要对接打印厂 | Pixieset 内置打印店 |
| 客户审阅 | 需要建挑选/评论系统 | Pixieset 内置 |
| 相册设计 | 需要拖拽排版工具 | Pixieset 内置 |
| 维护成本 | 持续投入 | 零 |

Pixieset 在这个领域已是标准——如同不会自建 Stripe 来做支付，也不会自建 Pixieset 来做画廊。

---

## 集成方案：三步走

### Phase 1：画廊状态追踪（已完成 60%）

**已有**：
- `PixiesetAdapter` — API 封装
- `GET /api/settings` — 检测 PIXIESET_API_KEY
- `POST /api/webhooks/pixieset` — 接收画廊发布事件
- `clients.pixieset_gallery_id` — 关联字段

**待补**：
- [ ] `GET /api/galleries` — 列出所有画廊（调 Pixieset API）
- [ ] `GET /api/clients/:id/galleries` — 客户关联的画廊
- [ ] Client detail 页显示画廊链接和状态
- [ ] Dashboard 面板显示待审阅/已下单的画廊

### Phase 2：自动创建画廊（新增）

**触发时机**：客户接受提案 → client.stage = 'booked'

**流程**：
1. 客户接受提案
2. 自动调用 Pixieset API 创建画廊（名为 "{客户名} - {套餐名}"）
3. 保存 gallery_id 到 clients 表
4. 在客户卡片显示 "📸 Gallery: Ready"
5. 可选：自动发送画廊链接邮件给客户

**API 需求**（Pixieset 可能不支持程序化创建，需验证）：
- 如果 Pixieset API 不支持创建 → 手动在 Pixieset 创建，然后在 StudioSage 中关联 ID
- 如果可以创建 → 全自动

### Phase 3：客户自助画廊（增强）

**Client Portal 扩展**：
- 客户登录后看到自己的画廊
- 嵌入 Pixieset 画廊 iframe
- 显示订单状态（打印/相册）
- 显示已选择/已购买的照片数量

---

## 本周可落地的具体任务

### Task 1：画廊列表 API（1小时）

```typescript
// server/src/api/galleries.ts
router.get('/', async (req, res) => {
  const key = process.env.PIXIESET_API_KEY;
  if (!key) return res.json({ galleries: [], configured: false });
  const pixieset = new PixiesetAdapter(key);
  const galleries = await pixieset.getGalleries();
  res.json({ galleries, configured: true });
});
```

### Task 2：Client 页显示画廊（1小时）

Client detail 面板新增 "📸 Galleries" 区块：
- 列出该客户关联的 Pixieset 画廊
- 显示：名称、状态、照片数、密码保护
- 点击跳转到 Pixieset 画廊链接

### Task 3：Dashboard 画廊提醒（30分钟）

面板增加 "🖼 Galleries Awaiting Review" 区块：
- 显示已发布但客户尚未查看的画廊
- 显示有打印订单待处理的画廊

---

## 需要的配置

```env
# .env 添加
PIXIESET_API_KEY=你的Pixieset API密钥
```

获取方式：Pixieset 后台 → Settings → API Keys → 生成。
