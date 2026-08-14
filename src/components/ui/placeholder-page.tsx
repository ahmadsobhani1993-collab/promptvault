type Props = { title: string; description: string }

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <section className="container-app py-20">
      <div className="card animate-slide-up p-10">
        <p className="gold-badge">Coming in next milestone</p>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">{description}</p>
      </div>
    </section>
  )
}
