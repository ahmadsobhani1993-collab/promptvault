export default function Canonical({ path }: { path: string }) {
  return <link rel="canonical" href={'https://promptsfa.ir' + path} />
}
