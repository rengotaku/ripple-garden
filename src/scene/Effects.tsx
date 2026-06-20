import {
  EffectComposer,
  BrightnessContrast,
  HueSaturation,
  Vignette,
} from '@react-three/postprocessing'
import { quality } from '../util/quality'

/**
 * 静かな夜の水面らしい雰囲気のための後処理。
 * 色調補正＋Vignette で落ち着いた夜の質感に。
 *
 * 注: Bloom は、雨がバーに集中して多数のバーが同時に発光した瞬間や、波立った
 * 水面の輝度が偶発的にしきい値を越えたときに画面全体が白飛びする不具合があったため
 * 採用していない（発光は素材自体の emissive と月の明るさで十分見える）。
 */
export function Effects() {
  return (
    <EffectComposer multisampling={quality.multisampling}>
      {/* 夜の水面らしい、ややシアン寄り・低彩度の落ち着いた色調へ。 */}
      <HueSaturation saturation={-0.08} />
      <BrightnessContrast brightness={-0.03} contrast={0.09} />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
    </EffectComposer>
  )
}
