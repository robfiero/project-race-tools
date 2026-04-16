import './SectionHeader.css';

interface Props {
  title: string;
  sub?: string;
  level?: 2 | 3;
}

export default function SectionHeader({ title, sub, level = 2 }: Props) {
  const Heading = `h${level}` as 'h2' | 'h3';
  return (
    <div className="section-header">
      <Heading className="section-title">{title}</Heading>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  );
}
