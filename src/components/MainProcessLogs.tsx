import React, { useEffect, useState, useRef } from 'react';

interface Log {
  type: 'log' | 'error' | 'warn';
  message: string;
  timestamp: string;
}

const MainProcessLogs: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we're in Electron
    if (window.electron && window.electron.logs) {
      const removeListener = window.electron.logs.onMainProcessLog((log: { type: string; message: string }) => {
        const newLog = {
          ...log,
          // Ensure type is one of the allowed values
          type: (log.type === 'log' || log.type === 'error' || log.type === 'warn') 
            ? log.type 
            : 'log' as const,
          timestamp: new Date().toISOString().split('T')[1].split('.')[0]
        };
        setLogs(prevLogs => [...prevLogs, newLog as Log]);
      });

      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!window.electron) {
    return null; // Don't render in web environment
  }

  return (
    <>
      <button 
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {isVisible ? 'Hide Logs' : 'Show Electron Logs'}
      </button>

      {isVisible && (
        <div 
          style={{
            position: 'fixed',
            bottom: '50px',
            right: '10px',
            width: '80%',
            maxWidth: '800px',
            height: '400px',
            backgroundColor: '#1e1e1e',
            color: '#f0f0f0',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '10px',
            overflow: 'auto',
            zIndex: 999,
            fontFamily: 'monospace',
            fontSize: '12px',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Electron Main Process Logs</h3>
            <button 
              onClick={() => setLogs([])}
              style={{
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          
          <div style={{ borderTop: '1px solid #444', paddingTop: '10px' }}>
            {logs.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index}
                  style={{
                    marginBottom: '5px',
                    color: log.type === 'error' ? '#ff6b6b' : 
                          log.type === 'warn' ? '#ffd166' : '#a3f7bf'
                  }}
                >
                  <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </>
  );
};

export default MainProcessLogs; 