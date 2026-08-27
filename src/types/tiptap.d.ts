import '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: string) => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}