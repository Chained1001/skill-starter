# skill-starter 开发说明

本文件写给在本仓库内开发的 agent。README.md 给人看，本文件回答两件事：这个仓库是什么；要做某件事时读哪份规则。

## 项目是什么

本仓库发布 skill-starter 技能：把随技能携带的基座内容（`skills/skill-starter/payload/`）生成为一个可直接开工的 skill 开发项目，规范、模板、校验器与测试一次到位。给要新开 skill 开发项目的开发者用，通过 `npx skills add Chained1001/skill-starter` 安装。`skills/skill-starter/` 由打包器从基座生成（当前基座版本见该目录 SKILL.md 的 `metadata.base-version`），改基座后在基座目录运行 `node scripts/pack.mjs <本仓库路径> --refresh` 重建该目录；根文件与 `test/`、`evals/` 是本仓库自己的内容，见下文「改动边界」。

## 开始之前

1. 读 `README.md` 的「技能列表」，知道有哪些技能。
2. 改哪个技能，就读它的 `SKILL.md`。
3. 要动规则，按 `docs/规范/00-总则.md` 的「按需查阅」表找到对应标准，只读那一份，不必全读。

## 环境准备

- Node.js 24 及以上。
- 零依赖：不运行 `npm install`，只用 `node:` 内置模块。
- 不需要联网，不需要额外环境变量。

## 目录与性质

| 路径 | 性质 | 说明 |
|---|---|---|
| `skills/` | 交付 | 唯一发布内容 |
| `templates/` | 留存 | 派生后必留，`scripts/init-skill.mjs` 运行时读取 |
| `docs/规范/` | 留存 | 标准副本，只读；改上游后重新复制 |
| `scripts/`、`test/`、`evals/` | 开发 | 只服务本仓库 |

性质三档：交付＝随 `npx skills add` 安装；留存＝随仓库保留但不安装；开发＝只服务本仓库。

## 改动边界

| 位置 | 可否手改 | 改动方式 |
|---|---|---|
| `skills/skill-starter/`（技能入口、生成器、payload） | 否，基座生成物 | 改基座源头，后在基座目录运行 `node scripts/pack.mjs <本仓库路径> --refresh` 只重建该目录 |
| 根文件（`README.md`、`AGENTS.md`、`CHANGELOG.md`、`package.json` 等）、`test/`、`evals/` | 是，本仓库内容 | 直接改 |

- 刷新只重建 `skills/skill-starter/`，不改本仓库其余任何文件，也不改 `package.json` 的 version。
- 刷新后由人把 `package.json` 的 version 与 `CHANGELOG.md` 对齐到基座版本：`test/e2e.test.mjs` 断言 SKILL.md、payload 与本仓库三处版本一致，不对齐即测试红。
- 不用全量模式（不带 `--refresh`）重打包本仓库：它会重置根文件、`test/`、`evals/` 与 CHANGELOG，清掉本仓库自有序。

## 事实源

一个事实只在一处写正文，其余位置写指针。

| 事实 | 事实源 |
|---|---|
| 目录与性质 | 本文件的「目录与性质」节 |
| 技能清单与用途 | `README.md` 的「技能列表」节 |
| 当前版本号 | `package.json` 的 `version` |
| 变更历史 | `CHANGELOG.md` |
| 规则 | `docs/规范/` |

两处冲突且判不出哪处是真源时，先裁决再动手，把结果记一行到下表；没有冲突时不建此表。

## 改动同步

| 改动 | 同次改 |
|---|---|
| 技能增删或改名 | `README.md` 的「技能列表」节 |
| `package.json` 的 `version` | `CHANGELOG.md` 的版本段 |
| 基座内容变动后运行 `node scripts/pack.mjs <本仓库> --refresh` | `package.json` 的 `version`、`CHANGELOG.md` 的版本段（对齐到基座版本） |

## 验证

| 命令 | 通过标准 |
|---|---|
| `npm run validate` | 退出码为 0 |
| `npm test` | 退出码为 0 |

## 提交

提交信息按 `docs/规范/04-提交与分支.md`。

## 禁止事项

- 禁止手改 `skills/skill-starter/` 下的技能入口、生成器与 payload，改为改基座源头后在基座目录运行 `node scripts/pack.mjs <本仓库路径> --refresh` 重建（原因：该目录是基座生成物，手改会在下次刷新时被覆盖）。随基座复制的 `docs/规范/`、`templates/`、`scripts/` 改动须回基座源头再同步，不就地分叉（原因：就地改会与基座漂移，且无检查能发现）。
- 禁止不先搜索已有 Issue 与 PR 就动手，改为先搜重再实现（原因：重复实现与冲突到审查才暴露）。
- 禁止 AI 产出的改动未经人过完整 diff 就提交，改为人核后提交（原因：机器门禁查不出语义越权）。

「原因」写可核查的后果，或写会被哪条检查发现，不写「更清晰」「更好维护」。
