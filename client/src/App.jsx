import React, { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import InputForm from './components/InputForm';
import StatusBadge from './components/StatusBadge';
import LogViewer from './components/LogViewer';
import DockerfilePreview from './components/DockerfilePreview';
import StepsTimeline from './components/StepsTimeline';

// In Docker (nginx proxy) use relative origin; in local dev fall back to localhost:5000
const SOCKET_URL = process.env.REACT_APP_API_URL || window.location.origin;

export default function App() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [logs, setLogs] = useState([]);
  const [dockerfile, setDockerfile] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const socketRef = React.useRef(null);

  useEffect(() => {
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const handleSubmit = useCallback(async (repoUrl) => {
    setLoading(true);
    setError('');
    setLogs([]);
    setDockerfile('');
    setStatus('pending');
    setAttempts(0);
    setJobId(null);

    if (socketRef.current) socketRef.current.disconnect();

    try {
      const { data } = await axios.post('/api/agent/start', { repoUrl });
      const newJobId = data.jobId;
      setJobId(newJobId);

      const newSocket = io(SOCKET_URL);
      socketRef.current = newSocket;

      newSocket.on(`job:${newJobId}`, ({ event, data: payload }) => {
        if (event === 'log') {
          setLogs(prev => [...prev, payload]);
        } else if (event === 'status') {
          setStatus(payload);
          if (payload === 'success' || payload === 'failed') {
            setLoading(false);
            // Fetch final job to get attempts count
            axios.get(`/api/agent/job/${newJobId}`).then(res => {
              setAttempts(res.data.attempts);
              if (payload === 'failed') setError(res.data.error || 'Build failed after all attempts.');
            });
          }
        } else if (event === 'dockerfile') {
          setDockerfile(payload);
        }
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setLoading(false);
    }
  }, []);

  const isTerminal = status === 'success' || status === 'failed';

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fa', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#24292f', marginBottom: 6 }}>
            🐳 Dockerfile AI Agent
          </h1>
          <p style={{ color: '#586069', fontSize: 15 }}>
            Paste a public GitHub repo URL — the agent will clone, analyze, generate, build and verify a working Dockerfile automatically.
          </p>
        </div>

        {/* Input */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e1e4e8' }}>
          <InputForm onSubmit={handleSubmit} loading={loading} />
        </div>

        {/* Steps Timeline */}
        {(loading || isTerminal) && (
          <div style={{ background: '#ffffff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e1e4e8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: '#586069', fontWeight: 600 }}>Progress</span>
              <StatusBadge status={status} />
            </div>
            <StepsTimeline status={status} attempts={attempts} />
          </div>
        )}

        {/* Error Banner */}
        {status === 'failed' && error && (
          <div style={{
            background: '#fff5f6', border: '1px solid #f0aeb6',
            borderRadius: 10, padding: '14px 18px', color: '#86181d', fontSize: 14
          }}>
            <strong>❌ Build Failed:</strong> {error}
          </div>
        )}

        {/* Success Banner */}
        {status === 'success' && (
          <div style={{
            background: '#f0fff4', border: '1px solid #c6f6d5',
            borderRadius: 10, padding: '14px 18px', color: '#1a7f37', fontSize: 14
          }}>
            <strong>✅ Success!</strong> Docker image built and container verified successfully
            {attempts > 1 ? ` after ${attempts} attempt(s).` : '.'}
          </div>
        )}

        {/* Dockerfile Preview */}
        {dockerfile && <DockerfilePreview dockerfile={dockerfile} attempt={attempts} />}

        {/* Logs */}
        {logs.length > 0 && <LogViewer logs={logs} />}

        {/* Initial placeholder */}
        {!loading && !isTerminal && !jobId && (
          <div style={{
            textAlign: 'center', padding: 48, color: '#586069',
            border: '1px dashed #e1e4e8', borderRadius: 12, background: '#ffffff'
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}></div>
            <p style={{color: '#24292f'}}>Enter a GitHub repository URL above to get started.</p>
            <p style={{ fontSize: 13, marginTop: 8, color: '#586069' }}>
              Supports Node.js, Python, Go, Java, Next.js, PHP and more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
