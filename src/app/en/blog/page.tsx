import OriginalPage from '@/app/blog/page'

export const dynamic = 'force-dynamic'

export default function EnPage(props: any) {
  return <OriginalPage {...props} />
}