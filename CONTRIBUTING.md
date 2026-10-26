# Contributing to Tab Caretaker

感谢你参与 Tab Caretaker。Bug 报告、交互建议、文档修正和代码贡献都很受欢迎。

## 提交 Issue 前

- 先搜索现有 Issue，避免重复。
- Bug 请提供 Chrome 版本、扩展版本、复现步骤、预期结果和实际结果。
- 涉及隐私或安全的问题请不要公开提交，改按 [SECURITY.md](SECURITY.md) 报告。

## 开发环境

需要 Node.js 22+ 和 pnpm 10+：

```bash
pnpm install
pnpm dev
```

从 `chrome://extensions` 加载 `.output/chrome-mv3-dev`，修改权限或重新构建后点击“重新加载”。

## 提交变更

1. Fork 仓库并从最新 `main` 创建主题分支，例如 `feat/session-restore` 或 `fix/duplicate-guard`。
2. 保持改动聚焦；功能变化应同时补充或更新测试与文档。
3. 提交前运行：

   ```bash
   pnpm check
   pnpm test
   pnpm build
   ```

4. 使用清晰的提交信息，推荐 Conventional Commits，例如 `feat: add session restore`。
5. 创建 Pull Request，说明问题、方案、验证方式及界面变化截图。

## Pull Request 规则

- CI 必须通过。
- 至少需要 1 个批准审查，讨论必须解决。
- `main` 使用 squash merge；PR 标题应能直接作为最终提交标题。
- 不提交 `.output`、`node_modules`、本地日志、密钥或个人浏览数据。
- UI 改动应同时验证浅色和深色主题，以及弹窗、设置页、侧边栏中受影响的界面。

提交贡献即表示你同意按本项目的 [MIT License](LICENSE) 提供该贡献。

## 发布流程（维护者）

1. 在 Pull Request 中更新 `package.json` 版本，并确保变更已通过 CI、审查并合并到 `main`。
2. 更新本地主分支，创建与包版本完全一致的附注标签：

   ```bash
   git switch main
   git pull --ff-only
   git tag -a v0.1.0 -m "Tab Caretaker v0.1.0"
   git push origin v0.1.0
   ```

3. `Release` 工作流会再次执行类型检查和测试，运行 `pnpm zip`，生成 `SHA256SUMS.txt`，并创建 GitHub Release。
4. 在 Releases 页面确认 ZIP 和校验文件可下载。标签版本与 `package.json` 不一致时，工作流会失败且不会发布。

## English summary

Create a focused branch from the latest `main`, add tests and documentation for behavior changes, run `pnpm check && pnpm test && pnpm build`, and open a pull request. CI, one approving review, and resolved conversations are required. Maintainers publish releases by pushing a `v*` tag matching `package.json`. Contributions are provided under the MIT License.
