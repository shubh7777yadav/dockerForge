import React from 'react';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    color: '#586069', bg: '#f1f3f5' },
  cloning:    { label: 'Cloning',    color: '#0366d6', bg: '#e6f0ff' },
  analyzing:  { label: 'Analyzing',  color: '#6f42c1', bg: '#f3eefc' },
  generating: { label: 'Generating', color: '#d18d00', bg: '#fff7e6' },
  building:   { label: 'Building',   color: '#0366d6', bg: '#e6f0ff' },
  success:    { label: 'Success ✓',  color: '#1a7f37', bg: '#ecffef' },
  failed:     { label: 'Failed ✗',   color: '#86181d', bg: '#fff5f6' }
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isActive = ['cloning', 'analyzing', 'generating', 'building'].includes(status);

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 13, fontWeight: 600, letterSpacing: 0.3
    }}>
      {isActive && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: cfg.color,
          animation: 'pulse 1.2s ease-in-out infinite'
        }} />
      )}
      {cfg.label}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </span>
  );
}
