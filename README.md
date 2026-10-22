# skill-starter

发布 skill-starter 技能：把随技能携带的基座内容一条命令生成新的 skill 开发项目，给要新开项目、又想一次带上规范、模板与校验门禁的开发者。基座指技能随身携带的项目骨架快照（规范、模板、校验器、测试），位于 `skills/skill-starter/payload/`。文档与界面语言为中文。

状态：实验

## 安装

```bash
npx skills add Chained1001/skill-starter
```

前置条件：Node.js 24 及以上、git（提交前校验钩子需要）。

安装后确认：对该 agent 说「帮我新建一个 skill 开发项目，叫 demo」——技能被触发后在当前目录生成 `demo/` 项目，在其中运行 `npm run validate` 退出码 0。

## 技能列表

| 技能 | 用途 | 扩展键 |
|---|---|---|
| skill-starter | 用随技能携带的基座内容生成新的 skill 开发项目，规范、模板、校验门禁一次到位 | metadata |

扩展键只填实际用到的，没有就写「无」，多个用逗号分隔。可填哪些键见 `docs/规范/01-技能写法.md` 的 frontmatter 表。表与 `skills/` 目录的一致性由 `npm run validate` 检查。

## 目录

| 路径 | 说明 |
|---|---|
| `skills/` | 技能源码，唯一发布内容 |
| `skills/skill-starter/payload/` | 随技能携带的基座快照（`.md.tpl` 形态），生成项目时还原 |
| `templates/` | 新建技能用的模板，不要删 |
| `docs/规范/` | 开发标准 |
| `scripts/`、`test/`、`evals/` | 校验、测试、评测 |

## 开发

| 命令 | 作用 |
|---|---|
| `npm run validate` | 静态校验 `skills/` 与 README 技能表 |
| `npm test` | 运行全部测试 |

## 反馈

通过 GitHub Issue：https://github.com/Chained1001/skill-starter/issues

## 维护者

由作者个人维护。

## 许可证

MIT，见 LICENSE。
