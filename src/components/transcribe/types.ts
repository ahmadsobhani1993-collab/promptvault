export type Seg = { 
  id: string
  start: number
  end: number
  text: string
  [key: string]: any
}

export type Snapshot = { 
  segments: Seg[]
  style: Record<string, unknown>
}

export type Preset = {
  id: string
  name: string
  fontId: string
  size: number
  color: string
  bgColor: string
  bgOpacity: number
  outline: boolean
  karaoke: boolean
  hlColor: string
  textShadowBlur: number
  textShadowColor: string
  bgRadius: number
}

export type FontOption = {
  id: string
  label: string
  category: string
}

