# 基座

可直接复制到项目根的骨架。它就是派生后项目的样子：复制、替换根文件、删示例，就能开工。

## 结构

见 `../框架树.md` 第一节。本目录的每个文件都在那里有对应行。

## 内容

- `skills/` 是发布内容，基座内只留 `.gitkeep` 占位。
- `examples/skills/` 放两个示例：`framework-smoke`（最小技能）与 `example-pipeline`（多步骤分层写法）。派生时删除。
- `docs/规范/` 是 `../规范/` 的逐字副本，不在本目录修改，由 `test/standards.test.mjs` 比对。
- 根文件 `README.md`、`AGENTS.md`、`CHANGELOG.md`、`.gitignore`、`.gitattributes` 同时存在于本目录与 `templates/root/`：本目录的供基座自身使用，模板的供派生项目使用。

## 常用命令

```bash
npm run validate                                            # 静态校验 skills/ 与 README 技能表
npm test                                                    # 全部测试
node scripts/init-project.mjs ../新项目 --owner <owner> --repo <repo> --author <名>   # 生成新项目
node scripts/pack.mjs <目标> [--refresh]                      # 打包为 skill-starter 技能仓库（全量 / 只刷新技能目录）
node scripts/init-skill.mjs <name> --description "当…"       # 从模板生成技能
node scripts/init-skill.mjs <name> --workflow               # 同时生成 workflows/01 骨架
node scripts/init-skill.mjs <name> --reference --asset --agent   # 生成参考件、版式、子代理骨架
node scripts/init-skill.mjs <name> --eval                   # 生成 evals/cases/<name>.md
node scripts/init-skill.mjs <name> --all                    # 以上全部
node scripts/init-skill.mjs <name> --dry-run --json         # 只看动作，不落盘
node scripts/install-hooks.mjs                              # 安装 pre-commit 钩子（需先 git init）
node scripts/validate.mjs --json                            # 机器可读结果
```

退出码：`0` 通过，`1` 内容不合格，`2` 参数错误，`3` 环境缺失。

## 提交前校验

`install-hooks.mjs` 会在 `.git/hooks/pre-commit` 写入钩子，提交前运行 `validate` 与 `test`，任一失败则拒绝提交。仓库根不是项目根时，用 `--package-dir` 指定，例如框架仓内用 `--package-dir 基座`。

钩子由 Git 用 `sh` 执行。在禁止子进程管道的受限环境里，`sh` 无法创建信号管道，钩子会直接失败；这类环境只能用 `git commit --no-verify`。

## 模板

`templates/` 共 20 个，清单见 `../框架树.md` 第三节。`init-skill.mjs` 运行时读取 `templates/skill/` 与 `templates/eval/` 下的模板，所以 `templates/` 不能删。

## 派生

见 `../规范/09-项目派生.md`。
