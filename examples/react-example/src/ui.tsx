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
            <span style={{ marginRight: 6 }}>📱</span>
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
    <div style={rowStyle}>
      <span style={rowLabel}>{label}</span>
      <span style={{ ...rowValue, color: valueColor ?? '#111827' }}>{value}</span>
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
  border: '1.5px solid #e5e7eb',
  borderRadius: 6,
  fontFamily: 'inherit',
  background: '#fff',
  color: '#111827',
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
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const cardHeader: CSSProperties = {
  padding: '20px 20px 0',
};

const cardTitle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 18,
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '-0.02em',
};

const cardDesc: CSSProperties = {
  margin: '0 0 0',
  fontSize: 13,
  color: '#6b7280',
  lineHeight: 1.6,
};

const noteStyle: CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: 8,
  fontSize: 12,
  color: '#92400e',
  lineHeight: 1.5,
};

const cardBody: CSSProperties = {
  padding: 20,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  background: '#f9fafb',
  borderRadius: 8,
  border: '1px solid #f3f4f6',
};

const rowLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  fontFamily: 'monospace',
};

const rowValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'monospace',
};

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
  padding: 14,
  background: '#f9fafb',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  marginBottom: 16,
};

const controlItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  cursor: 'default',
};

const controlLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
