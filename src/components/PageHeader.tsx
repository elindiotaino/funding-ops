type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
};

export function PageHeader({ eyebrow, title, description, status }: PageHeaderProps) {
  return (
    <section className="page-header panel">
      <div className="page-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {status ? <p className="page-header__status">{status}</p> : null}
    </section>
  );
}
