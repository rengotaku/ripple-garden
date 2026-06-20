# ripple-garden プロジェクト方針

このリポジトリで作業する際の取り決め。グローバル設定（`~/.claude/CLAUDE.md`）に加えて、本ファイルの内容を優先して守ること。

## 「作れ」の定義（作成・変更指示の運用ルール）

ユーザーが「作れ」「作って」「実装して」「直して」「変えて」等の**作成・変更を伴う指示**を出した場合、
コミットやブランチ止まりにせず、**main へ反映するまで**を一連で完了させる。これがゴール。

1. **Issue 作成** — `gh issue create`
2. **worktree を切る** — `create-worktree`（`wt tree add --issue <URL>`）。main で直接作業しない
3. **実装＋検証** — `make typecheck` / `make build` / `make smoke` を通す
4. **PR 作成** — `gh pr create`（本文に `Closes #<issue>`）
5. **merge** — `gh pr merge <n> --merge` で main へ反映
6. **後始末** — リモートブランチ削除・worktree 撤去・ローカル main を ff 更新

> 「作れ」と言われたら 1〜6 まで。途中で止めない。

### いちいち確認しない

作業の各ステップ（merge してよいか・後始末してよいか・幅や色をどうするか等）を**逐一ユーザーに確認しない**。
方針と既定値の範囲で自分で判断し、一気に main 反映まで進める。質問は本当に判断不能なときだけ。

## 操作・検証

- ビルド/テスト/起動停止は **Makefile 経由**（`make run` / `make stop PORT=N` / `make build` / `make smoke` / `make typecheck`）。生コマンドを直接叩かない。
- dev サーバ起動は `make run`、停止は `make stop PORT=N`。古い worktree の dev/preview サーバが残ってポートを占有しがちなので注意（`localhost` が最新かは worktree とコミットを確認する）。
- コミットメッセージは Conventional Commits（`feat:` / `fix:` 等）。属性表記は付けない。
