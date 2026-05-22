import type { ReactNode, CSSProperties } from 'react';

interface DemoCardProps {
  title: string;
  description: string;
  note?: string;
  children: ReactNode;
}

export function DemoCard({ title, description, note, children }: DemoCardProps) {
  return (
    <div style={cardStyle}>
      <div style={cardHeader}>
        <h2 style={cardTitle}>{title}</h2>
        <p style={cardDesc}>{description}</p>
        {note && (
          <div style={noteStyle}>
            {note}
          </div>
        )}
      </div>
      <div style={cardBody}>{children}</div>
    </div>
  );
}

interface DataRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

export function DataRow({ label, value, valueColor }: DataRowProps) {
  return (
    <div style={rowStyle} data-testid={`row-${label}`}>
      <span style={rowLabel}>{label}</span>
      <span style={{ ...rowValue, color: valueColor ?? '#111111' }} data-testid={`row-${label}-value`}>{value}</span>
    </div>
  );
}

interface ControlGridProps {
  children: ReactNode;
}

export function ControlGrid({ children }: ControlGridProps) {
  return <div style={controlGridStyle}>{children}</div>;
}

interface ControlItemProps {
  label: string;
  children: ReactNode;
  span?: boolean;
}

export function ControlItem({ label, children, span }: ControlItemProps) {
  return (
    <label style={{ ...controlItemStyle, gridColumn: span ? '1 / -1' : undefined }}>
      <span style={controlLabel}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  padding: '6px 8px',
  fontSize: 13,
  border: '1.5px solid #ddd9d3',
  borderRadius: 6,
  fontFamily: "'JetBrains Mono', monospace",
  background: '#fff',
  color: '#111111',
  outline: 'none',
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

export const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e8e5e0',
  overflow: 'hidden',
};

const cardHeader: CSSProperties = {
  padding: '24px 24px 0',
};

const cardTitle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 22,
  fontWeight: 800,
  color: '#111111',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
};

const cardDesc: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: '#6b6860',
  lineHeight: 1.65,
};

const noteStyle: CSSProperties = {
  marginTop: 14,
  padding: '10px 14px',
  borderLeft: '3px solid #e86035',
  background: '#fdf6f2',
  fontSize: 12,
  color: '#5c3520',
  lineHeight: 1.6,
};

const cardBody: CSSProperties = {
  padding: 24,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '9px 12px',
  background: '#f5f4f1',
  borderRadius: 6,
  border: '1px solid #e8e5e0',
};

const rowLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#9c9890',
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.02em',
};

const rowValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'JetBrains Mono', monospace",
};

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
  padding: 14,
  background: '#f5f4f1',
  borderRadius: 8,
  border: '1px solid #e8e5e0',
  marginBottom: 20,
};

const controlItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  cursor: 'default',
};

const controlLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#9c9890',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontFamily: "'JetBrains Mono', monospace",
};
