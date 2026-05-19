import type { ReactNode } from 'react';
import './SectionHeader.css';

interface Props {
  title: string;
  sub?: string;
  level?: 2 | 3;
  contextStrip?: ReactNode;
}

export default function SectionHeader({ title, sub, level = 2, contextStrip }: Props) {
  const Heading = `h${level}` as 'h2' | 'h3';
  return (
    <div className="section-header">
      <Heading className="section-title">{title}</Heading>
      {sub && <p className="section-sub">{sub}</p>}
      {contextStrip}
      <div className="section-divider" aria-hidden="true" />
    </div>
  );
}
