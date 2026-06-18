# Block Snap — 架构重构分析（v3）

## 你的核心修正

你说得对。之前的架构把"爬虫"当成数据主要来源——错了。

正确姿势：

```
数据主力来源 = 玩家的客户端上传（用户生成内容）
爬虫的角色   = 按需补充外链信息（极轻量）
MQ的作用     = 高峰削峰（电商秒杀同款逻辑）
ES的数据源   = 用户上传的模组数据（不是爬虫数据）
```

这不是退步，是架构更诚实了。


## 修正后的技术栈必要性

### 1. RabbitMQ —— ✅ 绝对刚需（秒杀级场景）

**痛点**：每晚 8-10 点高峰，数万玩家同时启动 Minecraft。

每个客户端上传 100-200 条模组信息 + 资源包 + 光影包 + 配置文件 = 单次请求 20-50KB JSON。

```
高峰期 5000 并发写入 × 200条资产 = 100万 INSERT/秒
```

Spring Boot 的 Tomcat 默认 200 线程。5000 并发直写 MySQL+ES → 连接池打穿 → 请求超时 → 数据丢失。

**MQ 就是唯一解**：

```
客户端 → POST /api/snapshot → RabbitMQ → 消费者（按自己的节奏消费）
                                          ├── 写 MySQL（事务）
                                          ├── 写 Elasticsearch（索引）
                                          └── 写 Redis（实时统计）
```

这和淘宝秒杀完全一样的模式：
- 秒杀：用户请求 → MQ → 扣库存
- Block Snap：玩家上传 → MQ → 写入 MySQL+ES

**没有 MQ 的结果**：高峰时段服务不可用，数据丢失。

### 2. Elasticsearch —— ✅ 刚需（用户数据的唯一检索入口）

**ES 的数据从哪来？玩家上传。**

场景：腐竹想看"所有用我整合包的 200 个玩家里，谁的 Create 版本没更新？"

```sql
-- MySQL 做这件事：
SELECT instance_id, version FROM mod_asset
WHERE mod_id = 'create'
  AND version != '0.5.1f'    -- 整合包要求的版本
  AND snapshot_id IN (
    SELECT id FROM snapshot WHERE instance_id IN (
      SELECT id FROM instance WHERE bound_modpack_id = 5
    )
  );
-- 跨三张表 JOIN，200人×20次快照 = 4000条记录，勉强能跑
```

```json
// ES 做这件事：
GET /mod_asset/_search
{
  "query": {
    "bool": {
      "must": [
        { "term": { "mod_id": "create" } },
        { "term": { "bound_modpack_id": 5 } }
      ],
      "must_not": [{ "term": { "version": "0.5.1f" } }]
    }
  },
  "aggs": { "by_instance": { "terms": { "field": "instance_id" } } }
}
// 毫秒级返回，不需要 JOIN
```

**ES 的必要性场景**：

| 查询 | MySQL | ES |
|------|-------|-----|
| "全服谁在用 Create v0.5.1f" | 跨表 JOIN，秒级 | 毫秒级 |
| "模组名包含'opti'的所有版本" | LIKE '%opti%' 全表扫描 | 倒排索引，毫秒级 |
| "Create 在各整合包中的版本分布" | 多表聚合，复杂 | aggregation 一行搞定 |
| "全服加载最慢的 10 个模组" | ORDER BY + LIMIT | 同 |

> ES 的数据源是用户上传的模组信息。每个快照写入 MySQL 的同时索引进 ES。
> 不需要爬虫填充 ES。爬虫只负责按需拉取外链上的 changelog。

### 3. 爬虫 —— ⚠️ 降级为极轻量按需服务

**不爬全站。只做一件事：**

```
用户点击某模组的"查看更新日志"
  → 后端检查缓存（Redis）
    → 有缓存 → 直接返回
    → 无缓存 → 调爬虫微服务
      → HTTP GET https://curseforge.com/.../changelog
      → 解析页面，提取文本
      → 返回 + 写入缓存（Redis, TTL=24h）
```

**数据量估算**：
- 用户实例里平均 100 个模组
- 其中 10% 用户会点进去看 changelog
- 每天几百次爬取请求
- 每条 changelog 1-5KB 文本

**不需要 ES 存爬虫数据。** changelog 就是普通文本，存 MySQL `platform_update` 表或 Redis 缓存就够了。

### 4. Redis —— ✅ 缓存 + 实时统计

| 用途 | 数据 | TTL |
|------|------|-----|
| 爬虫结果缓存 | changelog 文本 | 24h |
| 实时在线玩家数 | 心跳计数 | 5min |
| 热点模组排行 | ZSET sorted by install count | 1h |
| API 限流 | 用户请求计数器 | 1min |
| Session | 登录态 | 30min |

### 5. Spring Cloud 微服务拆分

有了 MQ + ES + 爬虫 + Python LLM，单体 Spring Boot 会变成这样：

```
单个进程里塞了：
├── 200 线程处理 HTTP 请求
├── RabbitMQ 消费者（持续消费）
├── 爬虫线程池（阻塞 IO）
└── 将来还要调 Python LLM（HTTP 调用）
```

结果：爬虫正在等 CurseForge 响应（3 秒），HTTP 线程池被消费者占满 → 用户登录超时。

**服务拆分必要性**：

| 服务 | 为什么独立 |
|------|-----------|
| `block-snap-gateway` | 统一入口，限流，鉴权 |
| `block-snap-user` | 用户服务，轻量 |
| `block-snap-instance` | 实例 + 快照写入，对接 MQ 消费者 |
| `block-snap-crawler` | 按需爬虫，独立线程池，不阻塞业务 |
| `block-snap-search` | ES 查询封装，独立扩容 |
| `block-snap-ai` | Python 微服务（LLM），见下文 |

这不是过度设计——每个服务有独立的资源瓶颈和扩容需求。


## Python + LLM 模块设计

### 为什么是 Python？

Java 生态在 LLM 领域严重落后。LangChain、HuggingFace、vLLM 全是 Python 原生。用 Java 调大模型相当于用筷子喝汤——能，但蠢。

### 可以用 LLM 做什么？

#### 模块一：更新日志智能分析

```
输入: 模组作者写的 changelog 原文
  "Rewrote the entire kinetic system. Old stress values are DEPRECATED.
   All addon mods MUST update to compatible versions.
   Added steam engines and electric networks."

输出: {
  "isBreaking": true,
  "riskLevel": "DANGER",
  "summary": "传动系统完全重写，旧的 stress 值已废弃，
              所有附属模组必须更新。新增蒸汽引擎。",
  "affectedAddons": ["Create: Steam 'n' Rails", "Create: Crafts & Additions"],
  "actionItems": [
    "升级前确认所有 Create 附属模组已发布兼容版本",
    "旧的 stress 配置需要手动迁移"
  ]
}
```

#### 模块二：崩溃诊断

```
输入: crash-report.txt + 模组列表 JSON

输出: {
  "likelyCause": "Create v0.5.1f 与 Flywheel v1.0.0 不兼容",
  "confidence": 0.87,
  "suggestions": [
    "升级 Flywheel 到 v1.0.3 或更高版本",
    "或降级 Create 到 v0.5.0"
  ]
}
```

#### 模块三：更新建议引擎

```
输入: 用户实例的完整资产状态

输出: {
  "safeUpdates": [
    { "mod": "JEI", "from": "15.12.0", "to": "15.12.1", "risk": "SAFE" }
  ],
  "cautionUpdates": [
    { "mod": "Create", "from": "0.5.1f", "to": "0.6.0", "risk": "DANGER",
      "reason": "破坏性 API 变更，需要同步升级 3 个附属模组" }
  ],
  "compatibleAddons": [
    "Create: Steam 'n' Rails v1.5.0 已适配 Create 0.6.0"
  ]
}
```

#### 模块四：整合包兼容性评分

```
输入: 整合包的模组清单

输出: {
  "compatibilityScore": 72,
  "conflicts": [
    { "modA": "OptiFine HD U G5", "modB": "Sodium 0.5.11",
      "severity": "CRITICAL", "note": "已知渲染冲突" }
  ],
  "warnings": [
    "3 个模组已 End of Life",
    "Fabric API 版本落后 5 个大版本"
  ]
}
```

### 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| Web 框架 | FastAPI | 异步，性能好，Python 微服务首选 |
| LLM 调用 | LangChain + OpenAI-compatible API | 通用接口，可切换模型 |
| 本地模型 | Qwen2.5-7B (GGUF) | 中文友好，7B 够用，消费级 GPU 可跑 |
| 或 API | DeepSeek API | 零部署，按量付费 |
| 向量检索 | ChromaDB | 轻量，不需要单独部署 |
| 任务队列 | Celery + Redis | LLM 推理慢（3-10s），不能阻塞 HTTP |

### 部署架构

```
┌──────────────────────────────────────────────────┐
│  block-snap-ai (Python FastAPI, port 8085)        │
│                                                   │
│  POST /ai/analyze-changelog    → LLM 推理         │
│  POST /ai/diagnose-crash       → LLM 推理         │
│  POST /ai/recommend-updates    → LLM 推理         │
│  POST /ai/check-compatibility  → LLM 推理         │
│                                                   │
│  内部: LangChain → DeepSeek API / Qwen 本地模型   │
│         Celery Worker → 异步推理，不阻塞 HTTP     │
└──────────────────────────────────────────────────┘
         ↑
         │ HTTP调用
         │
┌────────┴─────────────────────────────────────────┐
│  block-snap-instance (Java Spring Boot)           │
│  消费者处理完快照 → 调 AI 分析 changelog          │
│  用户请求诊断 → 调 AI 分析崩溃报告               │
└──────────────────────────────────────────────────┘
```

### LLM 任务的异步处理

LLM 推理需要 3-10 秒，不能同步等待。流程：

```
1. 爬虫拉到 changelog → POST /ai/analyze-changelog (async)
   → AI 服务返回 task_id
2. AI 服务 Celery Worker 后台推理
3. 推理完成 → 回调 Java 服务 POST /internal/ai-callback
   → Java 收到结果 → 写入 platform_update 表 → 前端通过 WebSocket 推送
```

### 这个模块如何证明"技术栈必要性"？

| 被证明的技术 | 理由 |
|-------------|------|
| **Python 独立微服务** | LLM 生态唯一选择，不可能用 Java 替代 |
| **Spring Cloud Gateway** | 路由 `/ai/*` 到 Python 服务，做鉴权和限流 |
| **Redis** | AI 推理结果缓存（同一个 changelog 不需要重复推理） |
| **消息队列** | AI 异步推理的回调解耦 |
| **微服务拆分** | Java 处理 CRUD，Python 处理 AI——异构语言必须拆 |


## 修正后的完整架构

```
                      ┌─────────────────────────────┐
                      │ 用户浏览器 (Vue 3)           │
                      └────────────┬────────────────┘
                                   │ HTTP
                      ┌────────────▼────────────────┐
                      │  Nginx (反向代理 + SSL)      │
                      └────────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ block-snap-gateway│  │ 静态资源 (dist)  │  │ WebSocket        │
│ (Spring Cloud)   │  └──────────────────┘  │ (实时推送)       │
│ 路由/限流/鉴权    │                        └──────────────────┘
└──────┬───────────┘
       │
       ├──▶ /instance/**  → block-snap-instance (核心服务)
       │                    ├── RabbitMQ Consumer (快照写入)
       │                    ├── MySQL → 业务数据
       │                    └── ES → 全文检索 + 聚合
       │
       ├──▶ /search/**    → block-snap-search (ES查询封装)
       │
       ├──▶ /crawler/**   → block-snap-crawler (按需爬虫)
       │                    └── Redis 缓存 changelog
       │
       ├──▶ /ai/**        → block-snap-ai (Python FastAPI)
       │                    ├── LLM 推理 (DeepSeek API / Qwen本地)
       │                    └── Celery 异步队列
       │
       └──▶ /user/**      → block-snap-user (用户服务)


数据流（核心链路）：

玩家开游戏 → POST /snapshot
  → RabbitMQ (削峰)
    → Consumer:
        ├── MySQL (INSERT mod_asset × 100)
        ├── ES (index 模组信息)
        ├── Redis (更新实时统计)
        └── 如有新模组外链 → 触发爬虫 → 爬 changelog → 调 AI 分析


数据流（AI 链路）：

爬虫拉到 changelog → POST block-snap-ai
  → Celery Worker:
      └── LLM 推理 (3-10s)
          └── 结果回调 → 写入 MySQL platform_update
              └── WebSocket 推送到前端
```


## 技术栈必要性终版

| 技术 | 必要性 | 废了它的后果 |
|------|--------|------------|
| **RabbitMQ** | ⭐⭐⭐⭐⭐ | 高峰期 5000 并发写入直接打崩服务 |
| **Elasticsearch** | ⭐⭐⭐⭐⭐ | 跨实例模组检索不可用，腐竹无法排查 |
| **Redis** | ⭐⭐⭐⭐ | 爬虫重复请求被限流，AI 结果重复推理 |
| **XXL-Job** | ⭐⭐⭐ | 定时清理过期快照、定时刷新 ES 索引 |
| **爬虫微服务** | ⭐⭐⭐ | 按需爬取，不阻塞主服务 |
| **Python AI 服务** | ⭐⭐⭐⭐⭐ | Java 做不了 LLM，异构语言必须独立进程 |
| **Spring Cloud** | ⭐⭐⭐⭐ | 异构服务路由、统一鉴权、限流 |
| **Docker Compose** | ⭐⭐⭐⭐⭐ | 8个服务 + 5个中间件，手动部署是噩梦 |
| **MySQL** | ⭐⭐⭐⭐⭐ | 关系数据，ACID，没它不行 |
| **Nginx** | ⭐⭐⭐⭐⭐ | 反向代理，SSL，静态资源 |


## 答辩重点

> "我们的 Elasticsearch 数据完全来自玩家上传的模组信息，不依赖大规模爬虫。
> 爬虫仅按需拉取用户主动点击的模组外链 changelog。
> MQ 用于应对高峰期数万玩家同时上传快照的削峰填谷——和电商秒杀同样的架构模式。
> AI 模块采用 Python 独立微服务，因为 Java 生态不具备 LLM 推理能力——这是异构服务拆分的真实需求，
> 不是'为了微服务而微服务'。"
