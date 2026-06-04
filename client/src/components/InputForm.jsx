import React, { useState } from 'react';

export default function InputForm({ onSubmit, loading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/username/repository"
        disabled={loading}
        required
        style={{
          flex: 1, padding: '12px 16px', borderRadius: 8,
          background: '#ffffff', border: '1.5px solid #e1e4e8',
          color: '#24292f', fontSize: 15, outline: 'none',
          transition: 'border-color 0.15s'
        }}
        onFocus={e => e.target.style.borderColor = '#0366d6'}
        onBlur={e => e.target.style.borderColor = '#e1e4e8'}
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        style={{
          padding: '12px 28px', borderRadius: 8, border: 'none',
          background: loading ? '#e1e4e8' : 'linear-gradient(135deg,#0366d6,#055ccc)',
          color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', transition: 'opacity 0.15s',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Running...' : '🚀 Analyze & Build'}
      </button>
    </form>
  );
}
