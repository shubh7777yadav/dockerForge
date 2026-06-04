import React from 'react';

const STEPS = [
  { key: 'cloning',    label: 'Clone Repository',     icon: '📦' },
  { key: 'analyzing',  label: 'Analyze Codebase',      icon: '🔍' },
  { key: 'generating', label: 'Generate Dockerfile',   icon: '🤖' },
  { key: 'building',   label: 'Build Docker Image',    icon: '🔨' },
  { key: 'success',    label: 'Container Verified',    icon: '✅' }
];

const ORDER = ['pending', 'cloning', 'analyzing', 'generating', 'building', 'success', 'failed'];

export default function StepsTimeline({ status, attempts }) {
  const currentIdx = ORDER.indexOf(status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
      {STEPS.map((step, i) => {
        const stepIdx = ORDER.indexOf(step.key);
        const isDone = currentIdx > stepIdx || status === 'success';
        const isCurrent = status === step.key;
        const isFailed = status === 'failed' && currentIdx - 1 === stepIdx;

        return (
          <React.Fragment key={step.key}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              minWidth: 90
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
                background: isFailed ? '#fff5f6' : isDone || isCurrent ? '#e6f0ff' : '#ffffff',
                border: `2px solid ${isFailed ? '#fdaeb5' : isCurrent ? '#0366d6' : isDone ? '#0366d6' : '#e1e4e8'}`,
                transition: 'all 0.3s'
              }}>
                {step.icon}
              </div>
              <span style={{
                fontSize: 11, color: isCurrent ? '#0366d6' : isDone ? '#0366d6' : '#586069',
                fontWeight: isCurrent ? 600 : 400, textAlign: 'center'
              }}>
                {step.label}
                {step.key === 'building' && attempts > 1 && (
                  <span style={{ color: '#d18d00', display: 'block' }}>Attempt {attempts}/3</span>
                )}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20, marginBottom: 20,
                background: currentIdx > ORDER.indexOf(step.key) ? '#0366d6' : '#e1e4e8',
                transition: 'background 0.3s'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
