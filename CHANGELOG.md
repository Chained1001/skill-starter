# Changelog

所有值得记录的变更都写在这里。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

## [0.5.3] - 2026-10-24

### Fixed

- 随基座 v0.5.3 刷新：`check-projects.mjs` 的同步范围漏检 18 个随包文件，含 `test/sandbox.mjs` 与 `test/` 下 6 个测试。范围原是九条手写枚举，覆盖 38 个文件，而派生项目实际收到 55 个。「基座改了、派生项目停在旧版」时它报「逐字一致」并退出 0。现改为按 `DROP` 清单反向推导，新增随包文件自动跟上
- `test/check-projects.test.mjs` 新增一条断言，把「范围等于派生项目实际收到的文件」钉住：独立用 `initProject` 生成项目、清点实际收到的文件，与 `expandScope` 双向比对。改回窄枚举时它会红
- `docs/规范/09-项目派生.md`：同步范围原写「下述固定清单」，把手写枚举当成事实源。改为指向推导规则并说明那一串是举例；已按上游 `规范/09` 同源更新

## [0.5.2] - 2026-10-24

### Added

- 随基座 v0.5.2 刷新：新增 `test/sandbox.mjs`，临时工作区只有一个实现。此前六个测试文件各写一遍「建临时树、跑、保证删掉」，位置分 `test/.tmp/` 与系统临时目录两套，清理分 `try/finally`、`after()`、只清一半三种；清理写错不会被任何断言发现，第 0.5.1 轮修的那个 `.tmp` 泄漏就是它的实例
- `test/cli.test.mjs`、`test/validate.test.mjs`、`test/install-hooks.test.mjs` 改用 `withSandbox`，删掉各自的 `tmpBase`/`after()`/`rmdir`；`noSpawn` 探针从三份合成一份（此前两处 skip 文案已经漂移）
- `AGENTS.md` 增「payload 是原料，不是可运行仓库」：写明 payload 里跑测试会有 10 条失败，原因是 `pack` 有意剔除根文件、Markdown 处于 `.md.tpl` 形态，属形态差异而非缺陷；并指明发布物的证明点在 `test/e2e.test.mjs` 展开后的项目里

### Changed

- `test/init-project.test.mjs` 未改用 `withSandbox`：该文件 484 行、22 处 `try/finally`，两次机械改写都把嵌套结构弄坏。它被 `init-project` 的 DROP 清单排除、不随包分发，留着不影响交付物；要改须逐条手工做

## [0.5.1] - 2026-10-24

### Added

- `test/sync.test.mjs`：把「本仓库 → payload」这条副本链变成可执行断言。逐段声明 `docs/规范/`、`templates/`、`scripts/`、`test/` 必须与 payload 逐字相等（Markdown 差 `.tpl` 后缀，`test/fixtures/` 同样），并检查 payload 里没有未声明的新增内容。此前这条链完全没有检查：给 `test/evals.test.mjs` 加一行，`npm test` 仍 87 项全绿。已验证它能抓单侧改动
- 该检查器的注释写明它只守三段中的一段：上游 → 基座 由基座的 `standards`/`templates` 测试守，payload → 派生项目 由基座的 `pack`/`check-projects` 守，两段的上游不在本仓库
- `test/init-project.test.mjs` 补三条 CLI 用例：`--dry-run` 的计划文本与「不落盘」、`--json` 下参数错与业务错的结构同构（只差退出码与 `code`）、`--help` 打印用法。生成器随技能交付，宿主调的就是这层壳，此前它零断言

### Fixed

- 随基座 v0.5.1 刷新：`init-skill` 在模板为 `.md.tpl` 形态时不再一律报「模板缺失」（payload 自带的测试此前 76 项 28 失败，发布物无法自证）；`init-skill.test.mjs` 不再每次运行都在工作树里留下临时目录；`validate` 的 `checkWorkflowFiles`、`checkWorkflowText`、`localLinks`、`parseFrontmatter` 四个导出补上直接测试
- `test/e2e.test.mjs` 的共享可变 `project` 改为显式的 `demoProject()` 依赖：此前三条测试靠模块级 `let` 传递产物，单独跑第二条会拿到 `undefined`，测试顺序成了隐含契约。现在每条都能独立运行，生成器仍只 spawn 一次
- 仓库根 `.base-version` 停在 0.4.0 而代码已是 0.5.1：基座 `check-projects.mjs` 据此报「落后 2 版」并退出码 1，而同步范围内 38 个文件逐字一致。该文件既不在 `DROP` 也不在 `ROOT_FILES`，`pack --refresh` 不写它，只能人工跟版本，于是必然过期。已更新为 0.5.1 并加测试锁住——陈旧的值比没有值更坏，它看起来有权威

## [0.5.0] - 2026-10-23

### Changed

- **BREAKING:** 随基座 v0.5.0 刷新：`init-project --force` 不再删除目标目录里的任何内容，只做「同名文件按源覆盖」。此前会连带删掉目标里用户的 `.git`（提交历史）、`node_modules` 与 `evals/`（手写用例）
- 随基座 v0.5.0 刷新：`init-skill --eval` 遇同名用例不再静默覆盖；`install-hooks` 识别 `core.hooksPath`；`init-project` 拒绝含引号、反斜杠、换行的 `--owner`/`--repo`

### Added

- 本仓库新增 `test/init-project.test.mjs`：直接覆盖生成器的 `--force` 非破坏、二次 `--force`、`--author` 注入、`--owner`/`--repo` 取值拒绝、自拷贝守卫等 8 条用例。此前生成器只有 e2e 的 3 条用例、16 处断言兜着
- `test/e2e.test.mjs` 补两条断言：六条下一步指引逐条出现（原注释写「五条」且只验 5 个关键词）、生成项目根的 `.base-version` 与 SKILL.md 的 `base-version` 一致

### Fixed

- 本仓库 `test/` 与基座测试的漂移补齐：`cli`、`init-skill`、`install-hooks`、`validate`、`evals` 五个测试文件与 `test/fixtures/invalid/outside-link/` 同步到基座版本（此前缺少 `E_IO` 归类、`E_COMPATIBILITY` 边界、`--package-dir` 取值拒绝、流程序号 99 上限等 14 条用例，`npm test` 却仍是绿的）
- 本仓库 `package.json` 的 `test` 补 Node ≥24 守卫，与 `templates/root/package.json` 及 payload 三处一致

## [0.4.0] - 2026-10-23

### Changed

- 随基座 v0.4.0 刷新：需求入口 PRD 门槛（规范 10，满足派单门槛先写 PRD 冻结需求再实现）、技能内子代理实例（摘要员，规范 07 八节格式与派发方式）、Enki 评审回灌的安全与容错修复全部随 payload 分发；根 AGENTS 模板带开工门槛，生成项目的 agent 从会话开始即受"先 PRD 后代码"约束

## [0.3.3] - 2026-10-23

### Changed

- 随基座 v0.3.3 刷新：code-review 修复入 payload——生成器与比对脚本的错误类统一为同一份（instanceof 跨模块可靠）、`.base-version` 文件名单一常量来源、同步范围补 `install-hooks.mjs`；仓库根 `install-hooks.mjs` 与规范 09 同步。check-projects 复核：版本一致、38 文件逐字一致（退出码 0）

## [0.3.2] - 2026-10-22

### Changed

- 随基座 v0.3.2 刷新并补同步仓库根：`npm test` 前置 Node 版本守卫（低版本第一步即中文报错）；生成器写 `.base-version` 版本戳，基座新增 `check-projects.mjs` 可比对派生项目落后情况——首次实跑即暴露本仓库根的规范副本与校验器停在 0.2.1 渲染的真实漂移，本次按同步范围补齐（`docs/规范/`、`validate`、`init-skill`、`templates/`），并补记 `.base-version`。经 check-projects 复核完全同步（退出码 0）

## [0.3.1] - 2026-10-22

### Changed

- 随基座 v0.3.1 刷新：payload 精简六个惰性根文件（README、AGENTS、CHANGELOG 模板与 `.gitignore`、`.gitattributes`、`.github/`，59 个降至 53 个——生成项目时它们会被根模板渲染件无条件覆盖，携带纯属浪费）；`LICENSE` 与 `package.json` 例外保留（版权行与版本号的读取源）。生成项目的产物与门禁经端到端冒烟验证不变

## [0.3.0] - 2026-10-22

### Added

- 同步基座 `pack.mjs` 的 `--refresh` 刷新模式：改基座后在基座目录运行 `node scripts/pack.mjs <本仓库> --refresh` 只重建 `skills/skill-starter/`，根文件、`test/`、`evals/` 与 CHANGELOG 不再被全量重打包清掉（本次技能目录即用该模式刷新）
- 随基座 v0.3.0 刷新：生成器输出补「基座版本」行与 LICENSE 版权指引（六条下一步）；防呆加固（自拷贝守卫、E_IO 兜底、E_INDEX 表格行匹配、参数校验）；规范副本 11 份；根 README 模板带「快速开始」五步（生成的项目自带上手指引）

### Changed

- `AGENTS.md` 补「改动边界」：`skills/skill-starter/`（入口、生成器、payload）是基座生成物不手改，改动走基座后刷新；根文件、`test/`、`evals/` 是本仓库内容可改；刷新后须把 `package.json` 的 version 与 CHANGELOG 对齐到基座版本（`test/e2e.test.mjs` 查三处版本一致）

### Fixed

- AGENTS.md 安装地址由旧用户名改为 `Chained1001/skill-starter`（其余文件在 v0.2.1 已改，此处漏网）；基座版本引用改为动态指向 `metadata.base-version`
- README 补基座定义、payload 目录行、安装后确认的可照念触发指令与 git 前置条件（四路产品审查落实）

## [0.2.1] - 2026-10-22

### Added

- 补质量闭环：e2e 测试模拟技能安装到宿主后从 payload 生成项目（门禁全过、冲突保护、输出指引），触发用例 `trig-starter`（应触发与不应触发各一条判据）

### Changed

- 安装地址、Issue 地址、`package.json` 仓库归属与 LICENSE 版权人由临时 git 用户名改为 `Chained1001`
- 发布到 github.com/Chained1001/skill-starter，tag `v0.2.0`；干净目录 `npx skills add` 安装与落地完整性经测试目录冒烟 r01 验证
- 从基座 v0.2.1 重新打包：修复克隆链路 CRLF 缺陷（r02 发现）——payload 模板经 autocrlf 克隆变 CRLF 导致生成项目测试失败；生成器渲染归一化 LF，仓库与 payload 携带 `.gitattributes`（`eol=lf`）

## [0.2.0] - 2026-10-22

### Added

- 从基座 v0.2.0 打包生成：技能入口、生成器、payload
