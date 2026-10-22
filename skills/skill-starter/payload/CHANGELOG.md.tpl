# Changelog

所有值得记录的变更都写在这里。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Added

- `pack.mjs` 新增 `--refresh` 刷新模式：只删除并重建 `<目标>/skills/skill-starter/`（SKILL.md、生成器、payload），不调用 `initProject`、不跑任何还原步骤——全量模式复用 `initProject`，其 `.md.tpl` 还原会扫整个目标树，把既有 payload 的 `.tpl` 改回 `.md`，新旧混杂（v0.2.1 发布 skill-starter 仓库时实际踩中，被迫清空重打包绕行）；刷新不动根文件、`test/`、`evals/` 与 `package.json` 的 version，版本跟进由人把仓库 version 与 CHANGELOG 对齐到基座版本（仓库 e2e 的三处版本一致断言强制）。技能组装抽为全量与刷新共用的 `assembleSkill`；`test/pack.test.mjs` 补刷新测试（保留仓库自有序且产物与全量一致、预置旧 payload 不腐蚀、目标不存在退出码 1、`--dry-run` 不落盘、`--help` 含 `--refresh`）；`规范/02` 脚本清单 pack 行补「或刷新」

## [0.2.1] - 2026-10-22

### Fixed

- 修复发布后克隆链路的 CRLF 缺陷（测试目录 skill-starter r02 发现）：Windows `autocrlf` 克隆把 payload 模板检出为 CRLF，`init-skill` 原样渲染导致下游按 `\n` 解析的测试报 `E_FRONTMATTER`。三层修复：`init-skill` 与 `init-project` 渲染时统一归一化 LF；测试解析改用 `\r?\n` 并补 CRLF 回归用例；新增 `.gitattributes` 根模板（`* text=auto eol=lf`），框架仓、基座、派生项目与打包产物全部携带，任何平台克隆均 LF

## [0.2.0] - 2026-10-22

### Added

- `scripts/pack.mjs` 与 `test/pack.test.mjs`：一条命令把基座打包为 skill-starter 技能仓库——复用 `initProject` 生成派生项目形态，在 `skills/skill-starter/` 组装技能入口（description 以「当」开头、基座版本号写入 `metadata.base-version`）、逐字复制的生成器与全部 `.md.tpl` 化的 payload，并渲染根 README 的技能表行；测试含结构断言与端到端冒烟（从产物 payload 生成项目后 `npm run validate` 与 `npm test` 退出码 0）
- `init-project` 的 `--source` 接受根 Markdown 模板为 `.md.tpl` 形态（打包产物即此形态）：齐备性检查两种名字都认，`.md.tpl` 还原先于根文件渲染，读取根模板时回退 `.tpl` 变体
- `init-project` 的 DROP 补 `scripts/pack.mjs` 与 `test/pack.test.mjs`：打包器与其测试只在基座成立，派生项目与打包产物均不携带
- `init-project` 新增 `--source <目录>`：从指定的基座内容目录生成项目，并把其中 `.md.tpl` 结尾的文件还原为 `.md`——基座内容可装进技能随身携带；缺省仍用本机基座，源目录缺七个根模板之一时报 `E_TEMPLATE`
- `init-project` 支持 `--name`：目录名不合法时可直接指定合法包名，不必先改目录名
- **BREAKING:** `validate` 新增 `E_NAME_RESERVED`：技能目录名为保留名时报错（原本可通过），清单与 `规范/03` 一致
- **BREAKING:** `validate` 对流程文件名仍含 `TODO` 的报 `E_PLACEHOLDER`：内容补全但忘改文件名不再静默通过（原本可通过）
- `base-only.test.mjs` 新增基座根 `.gitignore`、`ci.yml` 与模板的逐字比对：两份并存的文件此前无检查
- **BREAKING:** `validate` 新增 `E_BODY_SIZE`：`SKILL.md` 全文超 20000 字符报错（原本可通过）——宿主压缩后只重附前 20000 字符，500 行上限拦不住宽表格
- **BREAKING:** `validate` 新增 `E_INDEX`：根目录有 `README.md` 时，`skills/` 下每个技能目录必须被 README 提及（原本可通过），技能表不再只靠人工同步
- `test/version.test.mjs`：`package.json` 与 `CHANGELOG.md` 最新版本段一致性检查，发版做到一半即测试失败
- **BREAKING:** 评测用例新增「基线」小节：同一指令在无技能（或改动前版本）下运行一次再对照，评测从验收升级为归因；`evals.test.mjs` 同步检查该小节存在（既有用例若无该小节将不再通过）
- 行为评测新增触发用例（前缀 `trig-`）：测 `description` 触发准确性，应触发与不应触发各一条
- `规范/10-施工流程.md`：AI 参与的改动的施工流程——编排/执行角色分离、五条派单门槛、两层审查协议（机器门禁+语义六项清单）、有界重试与反模式清单（依据施工流程调研，`辅助内容/临时文件/开发框架/20261022_调研-施工流程/`）

### Changed

- `规范/01` frontmatter 键表拆为规范键与宿主扩展键两层，`allowed-tools` 由逗号分隔改为空格分隔对齐 agentskills 规范，`description` 补不适用条件与关键词写法（依据开源调研，`辅助内容/临时文件/开发框架/20261022_调研-开源技能项目/`）
- `规范/00` 原则 1 登记宿主扩展键为受控偏差
- `规范/01` 调用关系补一条：引用技能内脚本带解释器写 `node scripts/名称.mjs`
- `模板/root/AGENTS.md` 禁止事项补先搜重、人审 diff 两条协作纪律

### Fixed

- 基座根 `.gitignore` 去掉模板中没有的 `.tmp/`，两份恢复一致（测试临时目录实际只用 `test/.tmp/`）
- `规范/02` 对齐脚本实际行为：错误码表补 `E_HOOK`，脚本清单补 `install-hooks` 与 `init-project`，测试命令补 `--test-isolation=none`，`errors[]` 字段描述改为有归属文件时才含 `file`

## [0.1.0] - 2026-10-22

### Added

- `templates/root/GLOSSARY.md`，术语表模板
- `templates/test-run/运行说明.md` 与 `结论.md`，测试记录模板
- `规范/09-项目派生.md`，从基座建项目与回灌规则
- 基座自身的 `README.md`、`AGENTS.md`、`.gitignore`
- `test/base-only.test.mjs`，只在基座仓运行，派生时删除
- `规范/02` 新增「错误码」「脚本清单」「行为评测」三节
- `evals/cases/neg-empty-input.md`，空输入的负例
- `test/evals.test.mjs`、`test/examples.test.mjs`，把用例结构与示例合规纳入 `npm test`
- `规范/09` 新增「占位符」节，登记八个占位符的取值与出现位置
- `开发框架/模板/` 作为模板源头，`基座/templates/` 改为它的逐字副本
- `test/templates.test.mjs`，比对模板副本与源头，源头不在项目内时跳过
- `scripts/init-project.mjs`，一条命令把基座生成为新项目
- `test/init-project.test.mjs`，生成器的结构、校验、覆盖与 dry-run 测试
- `init-skill.mjs` 新增 `--reference`、`--asset`、`--agent`、`--eval`、`--all`，一次生成五类骨架
- `scripts/install-hooks.mjs` 安装 pre-commit 钩子，提交前强制跑 `validate` 与 `test`；`--package-dir` 可指定子目录
- `test/install-hooks.test.mjs`，覆盖安装、覆盖保护、非 git 仓库与 dry-run
- `test/cli.test.mjs` 在禁止子进程管道的环境下按条件跳过，原因写明恢复条件
- `npm test` 改用 `--test-isolation=none`，避免测试运行器自身 spawn 失败
- `模板/skill/workflow.md` 的「参考」节改为：无参考只写一行「无」，删掉下表
- `规范/02` 的覆盖下限写明哪条由 `evals.test.mjs` 检查、哪条靠人核对
- `test/evals.test.mjs` 新增「每个技能至少一条用例」的检查
- `init-project.mjs` 现在会删除自身与 `test/init-project.test.mjs`，与「仅基座」的声明一致

### Changed

- 框架树改为 19 个模板，补 `templates/` 与 `docs/规范/` 为必需项；删除第七节的进度清单，改为边界声明
- `规范/01-技能写法.md` 新增参考件三类与校验边界说明
- `规范/03-命名.md` 新增辅助内容的指针节，取代已删除的旧文件名引用
- `规范/05-版本与发版.md` 的 CHANGELOG 分类对齐 Keep a Changelog：加 `Security`，去掉 `Breaking`，破坏性变更改用 `**BREAKING:**` 前缀
- `templates/doc/PRD.md` 重写：补「假设、约束与依赖」，给优先级判据，验收接到评测用例
- `templates/root/README.md` 补状态、安装后确认、目录、反馈，扩展键改为按需填写
- `templates/root/AGENTS.md` 补起步、环境准备、事实源、提交规范；验证命令去掉不可能满足的「无跳过」
- `templates/root/CHANGELOG.md` 补 Keep a Changelog 格式声明
- `templates/root/GLOSSARY.md` 补收录标准
- `templates/root/package.json` 补 `description`、`license`、`repository`，`engines` 与 CI 统一为 24
- `templates/root/gitignore` 补 `.env`、`.env.*`、`*.tgz`
- `templates/root/ci.yml` 对齐 GitHub Node 起步模板：只跑 main 分支、加 `permissions`、`concurrency`、`timeout-minutes`、步骤命名；因零依赖不用 `npm ci` 与缓存
- 基座根目录的 `.github/workflows/ci.yml`、`.gitignore`、`package.json` 与模板同步
- `规范/09-项目派生.md` 的根文件替换清单补 `.gitignore` 与 `.github/workflows/ci.yml`
- `test/framework-tree.test.mjs` 改名为 `base-only.test.mjs`，补真实 `existsSync` 检查，不再在派生项目里崩溃
- `规范/02` 允许条件跳过，替代「禁止 skip」
- `规范/09` 保留 `skills/.gitkeep`、派生时删 `base-only.test.mjs`、检查节改为退出码 0
- `规范/00` 原则 2 与 4、变更节对齐 06 与技能内 `scripts/` 的实际结构
- `规范/03` 新增编号前缀表与跨文件引用规则
- `规范/06` 适用范围与文件头限定到 `docs/产品/`、`docs/技术/`
- `规范/07` 边界改为稳定的写作约定声明
- `规范/01` 去掉「目前」
- `规范/01` 的 frontmatter 节改为完整键表，与校验器的 `KNOWN_KEYS` 对齐；`description` 以「当」开头的规则把弃用技能列为例外
- `规范/05` 的弃用规则补 0.x 例外：弃用过一个 MINOR 即可删除，不必等 MAJOR
- `规范/02`、`04`、`05`、`08`、`09` 的收尾节统一为「变更」，记录位置统一到 `CHANGELOG.md`
- `templates/skill/SKILL.md` 的「总流程」改为可选，单步骤技能不强制建 `workflows/`
- `templates/root/README.md` 去掉 `{{用途}}`，改为 `TODO` 行
- `templates/doc/架构.md` 的状态格改为单选，三值说明移到表下
- `templates/eval/case.md` 补「被测技能」「样本」「运行方式」，判据表加「判定方法」，写明 `C-` 与 `J-` 不共用号段、硬性与参考的效力
- `templates/test-run/结论.md` 写明「部分通过」的判定条件
- `templates/script/script.mjs` 补 `--dry-run`、`--force` 与退出码 3 的说明
- `templates/skill/SKILL.md` 的 frontmatter 加一行注释，指向 `01` 的可选键表
- `templates/root/README.md` 的扩展键改为指向 `01`，不再就地列出三个键
- `规范/00` 的「源头与副本」节涵盖模板：源头 `开发框架/模板/`，副本 `基座/templates/`
- `规范/09` 的派生步骤说明 `templates/` 是副本，派生后不再与上游同步
- `规范/04` 按 Conventional Commits 1.0.0 补 `!` 与 `BREAKING CHANGE:` 脚注、脚注机制，类型表补 `build`、`style`、`perf`
- `规范/06` 新增「文档类型」节，按教程/操作/参考/解释四类给放置位置
- `模板/root/README.md` 补「维护者」节
- `模板/doc/架构.md` 改名为 `技术文档.md`，内容从 4 节扩到 10 节：目标与约束、上下文与边界、构建块、运行时视图、运行环境与部署、横切关注点、架构决策、质量属性与风险、术语、变更
- `规范/03` 的编号前缀表补 `D-`（架构决策）与 `R-`（风险）
- `规范/00` 新增「按需查阅」表：按任务找对应标准，不要求全读
- `模板/root/AGENTS.md` 改为任务优先：先看要做什么，再按表查标准
- `模板/root/README.md` 与 `package.json` 改用 `{{owner}}`、`{{repo}}` 占位符
- `规范/09` 补快速路径与 `{{owner}}`、`{{repo}}` 占位符登记
- `evals/cases/` 两份用例补齐「被测技能」「样本」「运行方式」「判据表」「覆盖」五处
- `examples/` 的 `摘要判据.md` 按参考件模板重写为 `J-` 判据表；`example-pipeline` 的输出节改为模板的四列结构，固定「无法摘要」写法

### Fixed

- `validate.mjs` 的引用检查也认反引号路径；占位符检查覆盖技能内全部 `.md`；`skills/` 是文件时不再抛 `ENOTDIR` 堆栈
- `init-skill.mjs` 模板缺失退出 3 并报 `E_TEMPLATE`；`--workflow` 序号自增，避免 `--force` 覆盖后重号；`description` 含换行、引号或 `$&` 不再破坏 YAML；先建目录再写文件，避免留下半截
- 基座 `AGENTS.md`、`开发框架/README.md` 去掉不可能满足的「无跳过」

### Removed

- 旧版草案归档到 `辅助内容/临时文件/开发框架/20261021_归档-旧版框架/`

### Security

- `.gitignore` 增加 `.env` 与 `.env.*`，防止密钥入库