import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { io } from 'socket.io-client';
import { getToken } from '../api.js';

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High', desc: 'Best quality, ~10 fps' },
  { value: 'medium', label: 'Medium', desc: 'Balanced, ~5 fps' },
  { value: 'low', label: 'Low', desc: 'Fast, ~2 fps' },
];

export function RemoteDesktop({ notify }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | streaming | error
  const [quality, setQuality] = useState('medium');
  const [screenInfo, setScreenInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const streamingRef = useRef(false);
  const frameRef = useRef(null);

  // Scale factor between canvas coordinates and actual screen coordinates
  const scaleX = useRef(1);
  const scaleY = useRef(1);

  const connect = useCallback(() => {
    if (streamingRef.current) return;

    const socket = io('/desktop', {
      transports: ['websocket'],
      auth: { token: getToken() },
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState('streaming');
      streamingRef.current = true;
      setLoading(true);
      socket.emit('start');
    });

    socket.on('screen-info', (info) => {
      setScreenInfo(info);
      // Canvas will be sized to fill container, compute scale factors
      const container = containerRef.current;
      if (container && info.width && info.height) {
        scaleX.current = info.width / container.clientWidth;
        scaleY.current = info.height / container.clientHeight;
      }
    });

    socket.on('frame', (base64) => {
      setLoading(false);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Fit canvas to container
        const container = containerRef.current;
        if (container) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            scaleX.current = (screenInfo?.width || w) / w;
            scaleY.current = (screenInfo?.height || h) / h;
          }
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        frameRef.current = img;
      };
      img.src = `data:image/png;base64,${base64}`;
    });

    socket.on('connect_error', (err) => {
      setState('error');
      streamingRef.current = false;
      notify?.('Desktop: ' + err.message, 'error');
    });

    socket.on('disconnect', () => {
      if (streamingRef.current) {
        setState('error');
        streamingRef.current = false;
      }
    });
  }, [notify]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('stop');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    streamingRef.current = false;
    setState('idle');
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // Handle mouse events on canvas
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * scaleX.current),
      y: Math.round((e.clientY - rect.top) * scaleY.current),
    };
  };

  const handleMouseDown = (e) => {
    const coords = getCanvasCoords(e);
    if (coords && socketRef.current?.connected) {
      socketRef.current.emit('mouse', {
        type: 'click',
        x: coords.x,
        y: coords.y,
        button: e.button === 2 ? 'right' : 'left',
        action: 'down',
      });
    }
  };

  const handleMouseUp = (e) => {
    const coords = getCanvasCoords(e);
    if (coords && socketRef.current?.connected) {
      socketRef.current.emit('mouse', {
        type: 'click',
        x: coords.x,
        y: coords.y,
        button: e.button === 2 ? 'right' : 'left',
        action: 'up',
      });
    }
  };

  const handleMouseMove = (e) => {
    if (e.buttons === 0) return;
    const coords = getCanvasCoords(e);
    if (coords && socketRef.current?.connected) {
      socketRef.current.emit('mouse', {
        type: 'move',
        x: coords.x,
        y: coords.y,
      });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (socketRef.current?.connected) {
      socketRef.current.emit('mouse', {
        type: 'scroll',
        deltaY: e.deltaY,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('keyboard', {
        type: 'keydown',
        key: e.key,
      });
    }
  };

  const changeQuality = (q) => {
    setQuality(q);
    if (socketRef.current?.connected) {
      socketRef.current.emit('set-quality', q);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        <span class="material-symbols-outlined" style={{ color: 'var(--brand-400)' }}>desktop_windows</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Remote Desktop</span>

        {state === 'streaming' && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--success)',
            marginLeft: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            Live
          </span>
        )}

        <span style={{ flex: 1 }} />

        {/* Quality selector */}
        {state === 'streaming' && (
          <select
            value={quality}
            onChange={(e) => changeQuality(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 10px',
              color: 'var(--text-main)',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label} - {o.desc}</option>
            ))}
          </select>
        )}

        {state === 'idle' && (
          <button class="btn primary" onClick={connect}>
            <span class="material-symbols-outlined">play_arrow</span> Start Streaming
          </button>
        )}

        {state === 'streaming' && (
          <button class="btn danger" onClick={disconnect}>
            <span class="material-symbols-outlined">stop</span> Stop
          </button>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          background: '#111',
          cursor: state === 'streaming' ? 'crosshair' : 'default',
        }}
      >
        {state === 'idle' && (
          <div class="empty">
            <span class="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.2 }}>desktop_windows</span>
            <div class="empty-title">Remote Desktop</div>
            <div class="empty-desc">
              Stream your desktop screen to any device. Control it with mouse and keyboard in real-time.
            </div>
          </div>
        )}

        {state === 'error' && (
          <div class="empty">
            <span class="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--danger)' }}>error</span>
            <div class="empty-title">Connection lost</div>
            <div class="empty-desc">The streaming connection was interrupted.</div>
            <button class="btn" style={{ marginTop: 12 }} onClick={() => { setState('idle'); disconnect(); }}>
              Retry
            </button>
          </div>
        )}

        {(state === 'streaming' || loading) && (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            style={{
              width: '100%',
              height: '100%',
              display: loading ? 'none' : 'block',
              outline: 'none',
            }}
          />
        )}

        {loading && (
          <div class="empty" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }}>
            <div class="loading-spinner" />
            <div class="empty-title">Streaming...</div>
          </div>
        )}
      </div>

      {/* Screen info bar */}
      {state === 'streaming' && screenInfo && (
        <div style={{
          height: 22,
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {screenInfo.width}&times;{screenInfo.height}
          <span style={{ margin: '0 12px', color: 'var(--text-dim)' }}>|</span>
          Quality: {quality}
          <span style={{ margin: '0 12px', color: 'var(--text-dim)' }}>|</span>
          Click to interact &middot; Scroll to zoom
        </div>
      )}
    </div>
  );
}
