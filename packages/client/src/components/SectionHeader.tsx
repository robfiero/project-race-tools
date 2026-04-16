import './SectionHeader.css';

interface Props {
  title: string;
  sub?: string;
}

export default function SectionHeader({ title, sub }: Props) {
  return (
    <div className="section-header">
      <h2 className="section-title">{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  );
}
