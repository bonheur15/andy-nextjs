"use client";

import { useCallback, useEffect, useState } from "react";
import type { SystemInfo } from "../action";
import { Terminal } from "./terminal";

type Tab = {
  id: number;
  cwd: string;
  name: string;
  busy: boolean;
};

type Props = {
  system: SystemInfo;
  initialCwd: string;
};

let tabCounter = 0;
const nextTabId = () => ++tabCounter;

function tabNameFor(cwd: string, home: string): string {
  if (cwd === home) return "~";
  const seg = cwd.split("/").filter(Boolean).pop();
  return seg ?? "/";
}

export function TerminalApp({ system, initialCwd }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: nextTabId(), cwd: initialCwd, name: "~", busy: false },
  ]);
  const [activeId, setActiveId] = useState<number>(() => tabs[0]?.id ?? 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const updateTab = useCallback((id: number, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const handleCwdChange = useCallback(
    (id: number, cwd: string) => {
      updateTab(id, { cwd, name: tabNameFor(cwd, system.home) });
    },
    [system.home, updateTab],
  );

  const handleBusyChange = useCallback(
    (id: number, busy: boolean) => updateTab(id, { busy }),
    [updateTab],
  );

  const handleClose = useCallback(
    (id: number) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          const fresh = { id: nextTabId(), cwd: initialCwd, name: "~", busy: false };
          setActiveId(fresh.id);
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        setActiveId((cur) => {
          if (cur !== id) return cur;
          const n = next[Math.max(0, idx - 1)];
          return n ? n.id : next[0].id;
        });
        return next;
      });
    },
    [initialCwd],
  );

  const handleNewSession = useCallback(() => {
    const fresh: Tab = { id: nextTabId(), cwd: initialCwd, name: "~", busy: false };
    setTabs((prev) => [...prev, fresh]);
    setActiveId(fresh.id);
  }, [initialCwd]);

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="term-window">
      <div className="term-titlebar">
        <div className="term-lights" aria-hidden>
          <span className="term-light term-light-red" />
          <span className="term-light term-light-yellow" />
          <span className="term-light term-light-green" />
        </div>
        <div className="term-title">
          <span className="term-title-dot" />
          {system.user}@{system.hostname}: {active ? active.name : "~"}
        </div>
        <div className="term-title-actions">
          <button className="term-iconbtn" onClick={handleNewSession} title="New session (Ctrl+K)" aria-label="new session">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
              <path d="M7.25 7.25V1.75a.75.75 0 0 1 1.5 0v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5Z" />
            </svg>
          </button>
          <button
            className="term-iconbtn"
            onClick={handleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label="toggle fullscreen"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
              {isFullscreen ? (
                <path d="M6.25 1.75a.75.75 0 0 0-1.5 0v3.5H1.75a.75.75 0 0 0 0 1.5h3.5v-3.5a.75.75 0 0 1 .75-.75h.25Zm3.5 0a.75.75 0 0 1 1.5 0v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-3.5a.75.75 0 0 1 .75-.75h.25ZM5.5 10.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4Zm6.75 0a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4Z" />
              ) : (
                <path d="M2.25 3.75a1.5 1.5 0 0 1 1.5-1.5h8.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5v-8.5Zm1.5 0v8.5h8.5v-8.5h-8.5Z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="term-tabsbar">
        <div className="term-tabs">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`term-tab ${t.id === activeId ? "term-tab-active" : ""}`}
              onClick={() => setActiveId(t.id)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className={`term-tab-dot ${t.busy ? "term-tab-dot-busy" : ""}`} />
              <span className="term-tab-label">{t.name}</span>
              <button
                className="term-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(t.id);
                }}
                aria-label={`close ${t.name}`}
              >
                <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            </div>
          ))}
          <button className="term-tab-new" onClick={handleNewSession} aria-label="new session">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path d="M8.75 1.75a.75.75 0 0 0-1.5 0v5.5h-5.5a.75.75 0 0 0 0 1.5h5.5v5.5a.75.75 0 0 0 1.5 0v-5.5h5.5a.75.75 0 0 0 0-1.5h-5.5v-5.5Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="term-screens">
        {tabs.map((t) => (
          <div key={t.id} className={t.id === activeId ? "term-screen" : "term-screen term-screen-hidden"}>
            <Terminal
              system={system}
              initialCwd={t.cwd}
              onCwdChange={(cwd) => handleCwdChange(t.id, cwd)}
              onClose={() => handleClose(t.id)}
              onNewSession={handleNewSession}
              onBusyChange={(busy) => handleBusyChange(t.id, busy)}
            />
          </div>
        ))}
      </div>

      <div className="term-statusbar">
        <div className="term-status-left">
          <span className={`term-status-dot ${active?.busy ? "term-status-dot-busy" : ""}`} />
          <span className="term-status-text">{active?.busy ? "running" : "connected"}</span>
          <span className="term-status-sep" />
          <span className="term-status-text term-status-mono">
            {system.user}@{system.hostname}
          </span>
        </div>
        <div className="term-status-center">
          <span className="term-status-mono term-status-cwd" title={active?.cwd}>
            {active?.cwd ?? ""}
          </span>
        </div>
        <div className="term-status-right">
          {active?.busy && (
            <span className="term-spinner" aria-label="working" />
          )}
          <span className="term-status-text term-status-mono">bash</span>
          <span className="term-status-sep" />
          <span className="term-status-text term-status-mono">
            {clock.toLocaleTimeString([], { hour12: false })}
          </span>
        </div>
      </div>
    </div>
  );
}
