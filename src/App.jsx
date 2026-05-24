import React, { useEffect, useMemo, useRef, useState } from "react";

const MODE = {
  STOPWATCH: "stopwatch",
  TIMER: "timer",
};

const formatTime = (ms, showMs = true) => {
  const safe = Math.max(0, ms);
  const h = Math.floor(safe / 3_600_000);
  const m = Math.floor((safe % 3_600_000) / 60_000);
  const s = Math.floor((safe % 60_000) / 1_000);
  const cs = Math.floor((safe % 1_000) / 10);

  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return showMs
    ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`
    : `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const ProgressRing = ({ pct, size = 220, stroke = 10 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <svg width={size} height={size} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--track)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "center",
          transition: "stroke-dashoffset 0.2s linear",
          filter: "drop-shadow(0 0 6px rgba(72, 227, 255, 0.5))",
        }}
      />
    </svg>
  );
};

const App = () => {
  const [mode, setMode] = useState(MODE.STOPWATCH);

  const [swState, setSwState] = useState({
    running: false,
    elapsed: 0,
    startTime: null,
    laps: [],
  });

  const [timerState, setTimerState] = useState({
    running: false,
    remaining: 0,
    total: 0,
    startTime: null,
    finished: false,
  });

  const [input, setInput] = useState({ h: "0", m: "1", s: "0" });
  const [flash, setFlash] = useState(false);

  const rafRef = useRef(null);

  const formattedSw = useMemo(() => formatTime(swState.elapsed, true), [swState]);
  const formattedTimer = useMemo(
    () => formatTime(timerState.remaining, false),
    [timerState]
  );

  const pct = timerState.total > 0 ? timerState.remaining / timerState.total : 0;

  const stopTicker = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startTicker = () => {
    stopTicker();
    const tick = () => {
      if (mode === MODE.STOPWATCH) {
        setSwState((s) => {
          if (!s.running || s.startTime == null) return s;
          return { ...s, elapsed: Date.now() - s.startTime };
        });
      } else {
        setTimerState((t) => {
          if (!t.running || t.startTime == null) return t;
          const remaining = t.total - (Date.now() - t.startTime);
          const done = remaining <= 0;
          return {
            ...t,
            remaining: Math.max(0, remaining),
            finished: done ? true : t.finished,
            running: done ? false : t.running,
          };
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (
      (mode === MODE.STOPWATCH && swState.running) ||
      (mode === MODE.TIMER && timerState.running)
    ) {
      startTicker();
    } else {
      stopTicker();
    }

    return stopTicker;
  }, [mode, swState.running, timerState.running]);

  useEffect(() => {
    if (mode !== MODE.TIMER) return;
    if (!timerState.finished) return;

    setFlash(true);
    const timeout = setTimeout(() => setFlash(false), 1200);

    const playBeep = () => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
        osc.onended = () => ctx.close();
      } catch (err) {
        // AudioContext may be blocked until user interaction.
      }
    };

    playBeep();
    return () => clearTimeout(timeout);
  }, [mode, timerState.finished]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        handleToggle();
      }
      if (e.key === "r" || e.key === "R") {
        handleReset();
      }
      if (e.key === "l" || e.key === "L") {
        if (mode === MODE.STOPWATCH) recordLap();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, swState.running, timerState.running, swState.elapsed, timerState.remaining]);

  const handleToggle = () => {
    if (mode === MODE.STOPWATCH) {
      setSwState((s) => {
        if (s.running) {
          return {
            ...s,
            running: false,
            elapsed: Date.now() - s.startTime,
          };
        }
        return {
          ...s,
          running: true,
          startTime: Date.now() - s.elapsed,
        };
      });
    } else {
      setTimerState((t) => {
        if (t.running) {
          const remaining = t.total - (Date.now() - t.startTime);
          return {
            ...t,
            running: false,
            remaining: Math.max(0, remaining),
          };
        }
        if (t.total <= 0) return t;
        const baseRemaining = t.remaining > 0 ? t.remaining : t.total;
        return {
          ...t,
          running: true,
          startTime: Date.now() - (t.total - baseRemaining),
          remaining: baseRemaining,
          finished: false,
        };
      });
    }
  };

  const handleReset = () => {
    if (mode === MODE.STOPWATCH) {
      setSwState({ running: false, elapsed: 0, startTime: null, laps: [] });
    } else {
      setTimerState({
        running: false,
        remaining: 0,
        total: 0,
        startTime: null,
        finished: false,
      });
    }
  };

  const recordLap = () => {
    setSwState((s) => {
      if (!s.running && s.elapsed === 0) return s;
      const lapTime = s.elapsed;
      const lastLap = s.laps[0] || 0;
      const delta = lapTime - lastLap;
      return {
        ...s,
        laps: [lapTime, ...s.laps],
        lastDelta: delta,
      };
    });
  };

  const applyTimerInput = () => {
    const h = Math.max(0, parseInt(input.h || "0", 10));
    const m = Math.max(0, parseInt(input.m || "0", 10));
    const s = Math.max(0, parseInt(input.s || "0", 10));
    const total = (h * 3600 + m * 60 + s) * 1000;

    setTimerState((t) => ({
      ...t,
      total,
      remaining: total,
      running: false,
      startTime: null,
      finished: false,
    }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
  };

  const handleInputChange = (field) => (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  const activeRunning =
    mode === MODE.STOPWATCH ? swState.running : timerState.running;

  return (
    <div className="app">
      <style>{`
        :root {
          --bg: #0f1114;
          --card: #161a1f;
          --accent: #48e3ff;
          --accent-soft: rgba(72, 227, 255, 0.15);
          --track: #2b313a;
          --text: #e6edf3;
          --muted: #9aa5b1;
          --danger: #ff6b6b;
        }

        * { box-sizing: border-box; }
        body { margin: 0; font-family: "Roboto Mono", "JetBrains Mono", monospace; }

        .app {
          min-height: 100vh;
          background: radial-gradient(circle at 20% 20%, #1b242c 0%, #0f1114 60%);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }

        .card {
          width: min(760px, 100%);
          background: linear-gradient(145deg, #14181e 0%, #101419 100%);
          border: 1px solid #242b33;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          display: grid;
          gap: 24px;
          position: relative;
          overflow: hidden;
        }

        .card::before {
          content: "";
          position: absolute;
          inset: -50% 20% auto auto;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(72, 227, 255, 0.3), transparent 70%);
          filter: blur(60px);
          opacity: 0.7;
          pointer-events: none;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .title {
          font-size: 20px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .toggle {
          display: inline-flex;
          background: #101418;
          border: 1px solid #28313b;
          border-radius: 999px;
          padding: 4px;
        }

        .toggle button {
          border: none;
          background: transparent;
          color: var(--muted);
          padding: 8px 18px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .toggle button.active {
          background: var(--accent);
          color: #0b1116;
          box-shadow: 0 0 16px rgba(72, 227, 255, 0.4);
        }

        .display {
          font-size: clamp(36px, 6vw, 64px);
          text-align: center;
          padding: 24px;
          border-radius: 16px;
          background: rgba(10, 14, 18, 0.7);
          border: 1px solid #222a33;
          letter-spacing: 0.08em;
          position: relative;
          transition: color 0.3s ease, box-shadow 0.3s ease;
        }

        .display.running {
          color: var(--accent);
          box-shadow: 0 0 30px rgba(72, 227, 255, 0.25);
        }

        .display.flash {
          color: var(--danger);
          animation: flash 0.4s ease-in-out 0s 3;
        }

        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        .main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .ring {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .controls button {
          background: #11161c;
          border: 1px solid #25303a;
          color: var(--text);
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s ease, background 0.2s ease, border 0.2s ease;
          min-width: 120px;
        }

        .controls button.primary {
          background: var(--accent);
          color: #0b1116;
          border-color: transparent;
        }

        .controls button:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
        }

        .controls button:active {
          transform: scale(0.98);
        }

        .inputs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: end;
        }

        .input-group {
          display: grid;
          gap: 6px;
        }

        .input-group label {
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .input-group input {
          background: #0f141a;
          border: 1px solid #2a3540;
          color: var(--text);
          padding: 12px;
          border-radius: 10px;
          font-size: 16px;
        }

        .laps {
          background: #0d1116;
          border: 1px solid #1c242d;
          border-radius: 16px;
          padding: 16px;
          max-height: 220px;
          overflow: auto;
        }

        .lap-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #1a2129;
          font-size: 14px;
        }

        .lap-row:last-child { border-bottom: none; }

        .lap-id {
          color: var(--muted);
        }

        .footer {
          display: flex;
          justify-content: space-between;
          color: var(--muted);
          font-size: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        @media (min-width: 900px) {
          .main {
            grid-template-columns: 1.1fr 0.9fr;
            align-items: center;
          }
        }

        @media (max-width: 640px) {
          .card { padding: 24px 18px; }
          .controls button { flex: 1; min-width: 0; }
        }
      `}</style>

      <div className="card">
        <div className="header">
          <div className="title">Precision Chrono Lab</div>
          <div className="toggle" role="tablist" aria-label="Mode toggle">
            <button
              type="button"
              className={mode === MODE.STOPWATCH ? "active" : ""}
              onClick={() => handleModeChange(MODE.STOPWATCH)}
              role="tab"
              aria-selected={mode === MODE.STOPWATCH}
            >
              Stopwatch
            </button>
            <button
              type="button"
              className={mode === MODE.TIMER ? "active" : ""}
              onClick={() => handleModeChange(MODE.TIMER)}
              role="tab"
              aria-selected={mode === MODE.TIMER}
            >
              Timer
            </button>
          </div>
        </div>

        <div
          className={`display ${activeRunning ? "running" : ""} ${
            flash ? "flash" : ""
          }`}
        >
          {mode === MODE.STOPWATCH ? formattedSw : formattedTimer}
        </div>

        <div className="main">
          <div className="ring">
            {mode === MODE.TIMER ? <ProgressRing pct={pct} /> : null}
          </div>

          <div>
            {mode === MODE.TIMER ? (
              <div className="inputs">
                <div className="input-group">
                  <label htmlFor="hours">Hours</label>
                  <input
                    id="hours"
                    inputMode="numeric"
                    value={input.h}
                    onChange={handleInputChange("h")}
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="minutes">Minutes</label>
                  <input
                    id="minutes"
                    inputMode="numeric"
                    value={input.m}
                    onChange={handleInputChange("m")}
                    placeholder="1"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="seconds">Seconds</label>
                  <input
                    id="seconds"
                    inputMode="numeric"
                    value={input.s}
                    onChange={handleInputChange("s")}
                    placeholder="0"
                  />
                </div>
              </div>
            ) : null}

            <div
              className="controls"
              style={{ marginTop: mode === MODE.TIMER ? 18 : 0 }}
            >
              <button
                type="button"
                className="primary"
                onClick={handleToggle}
                aria-pressed={activeRunning}
              >
                {activeRunning ? "Pause" : "Start"}
              </button>
              <button type="button" onClick={handleReset}>
                Reset
              </button>
              {mode === MODE.STOPWATCH ? (
                <button type="button" onClick={recordLap}>
                  Lap
                </button>
              ) : (
                <button type="button" onClick={applyTimerInput}>
                  Set Time
                </button>
              )}
            </div>
          </div>
        </div>

        {mode === MODE.STOPWATCH ? (
          <div className="laps" aria-live="polite">
            {swState.laps.length === 0 ? (
              <div className="lap-row">
                <span className="lap-id">No laps yet</span>
                <span>{formatTime(0, true)}</span>
              </div>
            ) : (
              swState.laps.map((lap, index) => (
                <div className="lap-row" key={`${lap}-${index}`}>
                  <span className="lap-id">Lap {swState.laps.length - index}</span>
                  <span>{formatTime(lap, true)}</span>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="footer">
          <span>Space: Start/Pause</span>
          <span>R: Reset</span>
          <span>L: Lap (Stopwatch)</span>
        </div>
      </div>
    </div>
  );
};

export default App;
