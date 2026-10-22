# Changelog

所有值得记录的变更都写在这里。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

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
