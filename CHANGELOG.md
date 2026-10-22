# Changelog

所有值得记录的变更都写在这里。格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Added

- 同步基座 `pack.mjs` 的 `--refresh` 刷新模式：改基座后在基座目录运行 `node scripts/pack.mjs <本仓库> --refresh` 只重建 `skills/skill-starter/`，根文件、`test/`、`evals/` 与 CHANGELOG 不再被全量重打包清掉（本次技能目录即用该模式刷新）

### Changed

- `AGENTS.md` 补「改动边界」：`skills/skill-starter/`（入口、生成器、payload）是基座生成物不手改，改动走基座后刷新；根文件、`test/`、`evals/` 是本仓库内容可改；刷新后须把 `package.json` 的 version 与 CHANGELOG 对齐到基座版本（`test/e2e.test.mjs` 查三处版本一致）

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
