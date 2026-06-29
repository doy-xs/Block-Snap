# Block Snap Web

Minecraft 实例变更追踪与游戏资产知识聚合平台 —— 前端演示

## v2 数据模型

```
Account → Instance → Snapshot[] → 五类资产 (Mod/ResourcePack/ShaderPack/Config/Modpack)
```

与核心结构设计文档对齐：不再以"启动记录"为中心，而是以"游戏实例"为中心，
每个实例拥有多次快照，通过快照 Diff 展示跨时间的资产变更。

## 四大板块

| 页面 | 说明 |
|------|------|
| 我的实例 | 实例列表卡片，支持收藏与备注，显示资产概要、更新提示 |
| 变更时间线 | 选实例，对比两次快照，五类资产的 ADD/REMOVE/UPDATE Diff |
| 版本更新 | 聚合 CurseForge/Modrinth 的平台更新信息流，破坏性变更标记 |
| MC 大事件 | 影响生态的重要事件时间线（版本发布/安全漏洞/模组里程碑） |
| 账户设置 | 对接后端 `/sys-user/**` 真实 API |

## 资产统合字段

每种资产共享五字段追踪：`version` `addedTime` `updateTime` `note` `isDeleted`

## 演示数据

- 2 个游戏实例（生存主世界 / 腐竹测试服）
- 每个实例 1-3 次快照历史
- 8 条平台更新信息（含破坏性变更）
- 6 条 MC 大事件（含安全漏洞）
- 实例收藏与备注（演示数据，本地保存）

## 启动

```bash
cd block-snap-web
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端网关代理：`/sys-user` → http://localhost

## 已对接后端 API

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 用户 | GET | `/sys-user/getAccount` | 账户信息（脱敏/验证后完整） |
| 用户 | POST | `/sys-user/login` 等 | 登录、注册、安全验证、换绑 |
| 实例 | GET | `/svc-instance/list` | 用户实例列表 |
| 实例 | PUT | `/svc-instance/favorite` | `{ instanceId, favorite }` |
| 实例 | PUT | `/svc-instance/note` | `{ instanceId, note }` |
| 模组 | GET | `/svc-mod/list?instanceId=` | 最新快照模组列表，`ModVo.id` = `mod_snapshot.id` |
| 模组 | PUT | `/svc-mod/favorite` | `{ modId, favorite }`，`modId` 为 `mod_snapshot.id` |
| 模组 | PUT | `/svc-mod/note` | `{ modId, note }`，`modId` 为 `mod_snapshot.id` |

网关代理：`/sys-user`、`/svc-instance`、`/svc-mod` → `http://localhost`

## 后续对接（演示数据 / 未实现）

后端需提供基于 Instance/Snapshot 模型的 API：

- `GET /instance` — 用户实例列表
- `GET /instance/{id}` — 实例详情 + 资产
- `GET /snapshot/{id}` — 单次快照数据
- `GET /snapshot/diff?older={id}&newer={id}` — 快照 Diff
- `GET /platform-updates?instanceId=` — 平台更新信息流
- `GET /mc-events` — MC 大事件
