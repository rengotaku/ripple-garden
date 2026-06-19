# ripple garden

放置系3D音ゲー：水滴が落ちて波紋が広がり、置いたオブジェクトに当たると音が鳴るジェネラティブ・ミュージック箱庭。

操作は不要。眺めているだけで、水滴がポタポタと落ち、水面に波紋が広がる。水面に置いた鉄琴バーに水滴が当たると、優しい音が 1 つ鳴る。

## 起動方法

```bash
npm install
npm run dev
```

ブラウザが開いたら、最初に一度クリックして音を有効にする（ブラウザの自動再生制限のため）。映像はクリック前から自動で動く。

その他のスクリプト：

```bash
npm run build      # 型チェック + 本番ビルド
npm run typecheck  # 型チェックのみ
npm run preview    # ビルド結果のプレビュー
```

## 技術スタック

- Vite + React + TypeScript
- React Three Fiber (`@react-three/fiber`) + `@react-three/drei`
- Tone.js（音）

## Phase 1（MVP）のスコープ

- **3D シーン**：水面の板を少し見下ろすカメラ。OrbitControls で視点を回せる。環境光＋ディレクショナルライトで影付き。
- **水滴**：上空のランダムな位置から、ゆらぎのある間隔で水滴が重力で落下し続ける（放置で自動生成）。
- **波紋**：着水位置にリングが生成され、拡大しながらフェードアウトして消える。
- **鉄琴バー**：水面に 1 本だけ置いた細長いバー。水滴が当たると Tone.js で音が鳴り、光るエフェクトと専用の波紋が出る。

### やらないこと（Phase 2 以降）

- 水面の反射/屈折シェーダー、波の干渉シミュレーション
- オブジェクト設置 UI、複数種類のオブジェクト、スコア/成長要素

## 構成

```
src/
  config.ts            シーン全体の調整パラメータ
  audio/synth.ts       Tone.js のシンセと発音
  scene/
    Scene.tsx          Canvas・カメラ・ライト・OrbitControls
    WaterPlane.tsx     水面の板
    RainSystem.tsx     水滴生成・着水判定・波紋/発音の統括
    Drop.tsx           1 滴の落下
    Ripple.tsx         1 つの波紋
    XylophoneBar.tsx   鉄琴バー（発光）
  ui/StartOverlay.tsx  音有効化のための初回クリック
```
