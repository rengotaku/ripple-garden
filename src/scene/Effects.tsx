import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  HueSaturation,
  Vignette,
} from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'

/**
 * 静かな夜の水面らしい雰囲気のための後処理。
 * 発光（鉄琴バー／着水の光）を Bloom で柔らかく滲ませ、Vignette で周辺を落として
 * 視線を中央へ集める。重すぎない控えめな設定。
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.7}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {/* 夜の水面らしい、ややシアン寄り・低彩度の落ち着いた色調へ。 */}
      <HueSaturation saturation={-0.08} />
      <BrightnessContrast brightness={-0.03} contrast={0.09} />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
    </EffectComposer>
  )
}
