export default function Card({ kicker, title, aside, children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`surface p-5 sm:p-6 ${className}`} {...rest}>
      {(kicker || title || aside) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {kicker && <p className="kicker mb-1">{kicker}</p>}
            {title && <h2 className="text-[1.3rem] leading-tight">{title}</h2>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </Tag>
  );
}
