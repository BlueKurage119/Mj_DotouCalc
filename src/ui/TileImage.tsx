// FluffyStuff riichi-mahjong-tiles (public domain) のReact SVG版 (riichi-mahjong-tiles, MIT)
import type { ComponentType, SVGProps } from 'react'
import {
  RegularChunM,
  RegularHakuM,
  RegularHatsuM,
  RegularMan1M,
  RegularMan2M,
  RegularMan3M,
  RegularMan4M,
  RegularMan5DoraM,
  RegularMan5M,
  RegularMan6M,
  RegularMan7M,
  RegularMan8M,
  RegularMan9M,
  RegularNanM,
  RegularPeiM,
  RegularPin1M,
  RegularPin2M,
  RegularPin3M,
  RegularPin4M,
  RegularPin5DoraM,
  RegularPin5M,
  RegularPin6M,
  RegularPin7M,
  RegularPin8M,
  RegularPin9M,
  RegularShaaM,
  RegularSou1M,
  RegularSou2M,
  RegularSou3M,
  RegularSou4M,
  RegularSou5DoraM,
  RegularSou5M,
  RegularSou6M,
  RegularSou7M,
  RegularSou8M,
  RegularSou9M,
  RegularTonM,
} from 'riichi-mahjong-tiles'
import type { TileInstance } from '../core/tiles'
import { tileName } from '../core/tiles'

type Svg = ComponentType<SVGProps<SVGSVGElement>>

// TileId (1-34) → 牌画コンポーネント
const TILES: Record<number, Svg> = {
  1: RegularMan1M, 2: RegularMan2M, 3: RegularMan3M, 4: RegularMan4M, 5: RegularMan5M,
  6: RegularMan6M, 7: RegularMan7M, 8: RegularMan8M, 9: RegularMan9M,
  10: RegularPin1M, 11: RegularPin2M, 12: RegularPin3M, 13: RegularPin4M, 14: RegularPin5M,
  15: RegularPin6M, 16: RegularPin7M, 17: RegularPin8M, 18: RegularPin9M,
  19: RegularSou1M, 20: RegularSou2M, 21: RegularSou3M, 22: RegularSou4M, 23: RegularSou5M,
  24: RegularSou6M, 25: RegularSou7M, 26: RegularSou8M, 27: RegularSou9M,
  28: RegularTonM, 29: RegularNanM, 30: RegularShaaM, 31: RegularPeiM,
  32: RegularHakuM, 33: RegularHatsuM, 34: RegularChunM,
}

const RED_TILES: Record<number, Svg> = {
  5: RegularMan5DoraM,
  14: RegularPin5DoraM,
  23: RegularSou5DoraM,
}

/** 牌画。sizeはCSSで .tile-img { width } により制御 */
export function TileImage({ tile }: { tile: TileInstance }) {
  const Comp = (tile.red && RED_TILES[tile.t]) || TILES[tile.t]
  if (!Comp) return null
  return (
    <span className="tile-img" role="img" aria-label={tileName(tile)}>
      <Comp />
    </span>
  )
}
