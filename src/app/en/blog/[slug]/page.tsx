import OriginalPage from '@/app/blog/[slug]/page'

export const dynamic = 'force-dynamic'

export default function EnPage(props: any) {
  return <OriginalPage {...props} />
}