'use client'

export function useVideoExport() {
  return {
    exporting: false,
    progress: 0,
    exportVideo: async () => {},
    cancelExport: () => {}
  }
}
