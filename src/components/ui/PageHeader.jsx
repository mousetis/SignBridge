export default function PageHeader({ kicker, title, children, actions }) {
  return (
    <header className="animate-rise mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-3xl">
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.1]">{title}</h1>
        {children && <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
