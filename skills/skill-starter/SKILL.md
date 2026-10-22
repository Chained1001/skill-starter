---
name: skill-starter
description: 当需要在当前环境新建一个带规范、模板与校验门禁的 skill 开发项目时使用，不用于编写单个技能的内容。
metadata:
  base-version: 0.3.0
---

# skill-starter

把随技能携带的基座内容（本目录 payload/）生成为一个可直接开工的 skill 开发项目：目录骨架、开发规范、模板、校验器与测试一次到位。所基于的基座版本是 0.3.0。

## 输入

| 字段 | 类型 | 必需 | 缺失时 |
|---|---|---|---|
| 目标目录 | 路径 | 是 | 停止并询问用户 |
| 项目名 | 文本：小写英文、数字与单连字符，不超过 64 位 | 是 | 停止并询问用户；目标目录名本身合法时可直接采用 |
| owner | 文本：GitHub 用户名或组织名 | 否 | 生成后由用户补进根 README 与 package.json |
| repo | 文本：仓库名 | 否 | 同 owner |
| author | 文本：版权人 | 否 | LICENSE 保留基座版权行，由用户后续修改 |

## 步骤

只有一个步骤，直接执行：

1. 确认目标目录与项目名。目标目录已存在且非空时，先向用户列明其中内容，取得对覆盖的明确同意后才继续（对应生成器的 --force）。
2. 在技能目录（本文件所在目录）下运行生成器，尖括号换成实际值：

   node scripts/init-project.mjs <目标目录> --source payload --name <项目名> --owner <owner> --repo <repo> --author <名>

   目录名即项目名时可省 --name；owner、repo、author 未提供时省去对应参数。当前目录不是技能目录时，脚本与 payload 的路径按当前目录换算，或改用绝对路径。
3. 把生成器的 stdout 原样报告给用户，再按「输出」小节补齐指引。

## 停止条件

- 目标目录已存在且非空，且用户未明确同意覆盖：停止，告知用户可换目录或同意覆盖。
- 生成器退出码非 0：把 stderr 原样转告用户，停止，不自行改动产物补救。
- 项目名不合法且用户不愿更换：停止。

## 输出

- 生成路径、项目名、所用基座版本号（0.3.0）。
- 六条下一步指引，逐条告知用户，均在新项目根目录执行：
  1. 未提供 --author 时，把 LICENSE 的版权行改为自己
  2. 补全根文件 README、AGENTS、CHANGELOG、package.json 里的占位内容
  3. node scripts/init-skill.mjs <技能名> 生成第一个技能
  4. git init
  5. node scripts/install-hooks.mjs 安装提交前校验
  6. npm run validate && npm test
