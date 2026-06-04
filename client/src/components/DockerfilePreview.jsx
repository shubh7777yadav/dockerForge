import React, { useState } from 'react';

export default function DockerfilePreview({ dockerfile, attempt }) {
  const [copied, setCopied] = useState(false);

  if (!dockerfile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(dockerfile).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ border: '1px solid #e1e4e8', borderRadius: 10, overflow: 'hidden', background: '#ffffff' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', background: '#fafbfc',
        borderBottom: '1px solid #e1e4e8'
      }}>
        <span style={{ color: '#0366d6', fontWeight: 600, fontSize: 14 }}>
          📄 Dockerfile {attempt > 1 ? `(Attempt ${attempt})` : ''}
        </span>
        <button onClick={handleCopy} style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5da',
          background: copied ? '#e6ffef' : '#ffffff',
          color: copied ? '#1a7f37' : '#24292f',
          fontSize: 12, cursor: 'pointer', transition: 'all 0.15s'
        }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 16, overflowX: 'auto',
        background: '#f6f8fa', maxHeight: 500,
        fontFamily: '"Cascadia Code","Fira Code","Consolas",monospace',
        fontSize: 13, lineHeight: 1.7, color: '#24292f',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word'
      }}>
        {dockerfile.split('\n').map((line, i) => {
          const isInstruction = /^(FROM|RUN|COPY|ADD|ENV|EXPOSE|CMD|ENTRYPOINT|WORKDIR|ARG|LABEL|USER|VOLUME|STOPSIGNAL)\b/.test(line);
          const isComment = line.trimStart().startsWith('#');
          return (
            <span key={i} style={{
              color: isComment ? '#586069' : isInstruction ? '#0366d6' : '#24292f',
              fontWeight: isInstruction ? 600 : 400
            }}>
              {line}{'\n'}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
