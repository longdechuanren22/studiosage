# AI 统管分析 & 改造建议

> 2026-06-16

---

## 一、当前 AI 架构

```
         ┌─────────────┐
         │   callAI()   │
         │ DeepSeek → Claude fallback
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
classify    invoice    proposal
Message    Generate    Generate
    │           │           │
    ▼           ▼           ▼
Offline     Offline     Template
Rules       Rules       Fallback
```

**问题**：DeepSeek key 返回 401 → 100% 走离线 → AI 形同虚设。

## 二、当前 AI 能力分布

| 功能 | 实现方式 | 质量 | 问题 |
|---|---|---|---|
| 邮件分类 | 离线规则引擎（50+关键词） | ★★★ | 不够细粒度 |
| 回复生成 | 离线模板+动态拼接 | ★★★ | 模板感强 |
| 发票明细 | 离线预设（wedding/portrait/event/commercial） | ★★★ | 无法根据聊天定制 |
| 提案生成 | callAI → 模板 fallback | ★★ | DeepSeek 挂了大半 |
| 实体提取 | 正则（纯离线） | ★★★★ | 工作稳定，无需 AI |
| 垃圾过滤 | 域名黑名单+正则 | ★★★★ | 工作稳定，无需 AI |

**核心矛盾**：最需要 AI 的三个功能（分类/回复/提案生成）都因 API key 失效而降级到离线。

## 三、改造方案

### 方案 A：修 DeepSeek key（最快，30 分钟）

```
.env 中 DEEPSEEK_API_KEY 替换为有效 key
→ 全部 AI 功能立即上线
→ 回复质量从 ★★★ → ★★★★★
→ 提案生成从模板 → AI 分析聊天记录
```

### 方案 B：双模型容灾（推荐，2 小时）

```typescript
// engine.ts
async function callAI(prompt, maxTokens, temp) {
  // Try Claude first (better quality)
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await callClaude(prompt, maxTokens, temp); }
    catch { /* fall through */ }
  }
  // Try DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    try { return await callDeepSeek(prompt, maxTokens, temp); }
    catch { /* fall through */ }
  }
  throw new Error('No AI provider available');
}
```

优势：一个模型挂了自动切另一个，零停机。

### 方案 C：AI 管理面板（最完整，1 天）

Settings 新增 AI 区块：
- 显示当前 AI 状态（Online/Offline/Fallback）
- 显示最近 24h AI 调用次数
- 显示平均响应时间
- 切换模型（Claude/DeepSeek）
- 测试连接按钮
- 显示 token 用量估算

## 四、建议

**立即**：方案 A — 换有效的 DeepSeek key（或加 ANTHROPIC_API_KEY）

**本周**：方案 B — 双模型容灾

**本月**：方案 C — AI 管理面板

**当前 401 问题本质**：不是代码问题，是 key 过期。代码的 fallback 逻辑是正确的——只是 fallback 被 100% 触发导致 AI 从未真正工作过。
