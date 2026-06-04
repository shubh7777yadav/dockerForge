import React, { useEffect, useRef } from 'react';

export default function LogViewer({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs.length) return null;

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e1e4e8', borderRadius: 10,
      padding: '16px', maxHeight: 380, overflowY: 'auto',
      fontFamily: '"Cascadia Code","Fira Code","Consolas",monospace', fontSize: 13,
      lineHeight: 1.7, color: '#24292f'
    }}>
      <div style={{ color: '#586069', marginBottom: 8, fontSize: 12, fontFamily: 'sans-serif' }}>
        Build Logs
      </div>
      {logs.map((line, i) => {
        const isError = /error|fail|cannot|not found/i.test(line);
        const isSuccess = /success|successfully|built|done/i.test(line);
        const isSeparator = line.startsWith('---');
        return (
          <div key={i} style={{
            color: isError ? '#d73a49' : isSuccess ? '#28a745' : isSeparator ? '#6f42c1' : '#586069',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all'
          }}>
            {line}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
