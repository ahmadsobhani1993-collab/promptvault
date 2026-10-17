declare module '*.css' {
  const content: Record<string, string>
  export default content
}

interface ArrayBufferLike {
  readonly byteLength: number
}
