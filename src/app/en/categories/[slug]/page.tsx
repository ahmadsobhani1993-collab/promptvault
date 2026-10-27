import OriginalPage from '@/app/categories/[slug]/page'

export const dynamic = 'force-dynamic'

export default function EnPage(props: any) {
  return <OriginalPage {...props} />
}