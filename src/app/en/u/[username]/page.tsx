import PublicProfilePage from '@/app/u/[username]/page'

export default function EnPublicProfilePage(props: { params: Promise<{ username: string }> }) {
  return <PublicProfilePage {...props} />
}
