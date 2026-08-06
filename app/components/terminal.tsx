"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SystemInfo, ExecResult } from "../action";
import { executeCommand, suggest } from "../action";
import { AnsiText } from "./ansi";
import { buildHistory, buildWelcome, buildExitMessage, HELP_TEXT } from "./content";

type Entry =
  | { id: number; kind: "output"; text: string }
  | { id: number; kind: "prompt"; command: string };

type Props = {
  system: SystemInfo;
  initialCwd: string;
  onCwdChange: (cwd: string) => void;
  onClose: () => void;
  onNewSession: () => void;
  onBusyChange: (busy: boolean) => void;
};

function prettyCwd(cwd: string, home: string): string {
  let p = cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
  if (p.length > 48) {
    const segs = p.split("/");
    if (segs.length > 4) p = "…/" + segs.slice(-3).join("/");
  }
  return p;
}

function Prompt({
  system,
  cwd,
}: {
  system: SystemInfo;
  cwd: string;
}) {
  const path = prettyCwd(cwd, system.home);
  return (
    <span className="term-prompt">
      <span className="tp-user">{system.user}</span>
      <span className="tp-mute">@</span>
      <span className="tp-host">{system.hostname}</span>
      <span className="tp-mute">:</span>
      <span className="tp-path">{path}</span>
      <span className="tp-sym">$</span>
    </span>
  );
}

export function Terminal({
  system,
  initialCwd,
  onCwdChange,
  onClose,
  onNewSession,
  onBusyChange,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(initialCwd);
  const [busy, setBusy] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const cwdRef = useRef(initialCwd);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);
  const mountedRef = useRef(true);

  const addEntry = useCallback((e: Entry) => {
    setEntries((prev) => [...prev, e]);
  }, []);

  const addOutput = useCallback((text: string) => {
    setEntries((prev) => [...prev, { id: idRef.current++, kind: "output", text }]);
  }, []);

  const pushHistory = useCallback((cmd: string) => {
    historyRef.current = [...historyRef.current.filter((c) => c !== cmd), cmd];
    historyIdxRef.current = -1;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    autoScrollRef.current = true;
    setAutoScroll(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    addOutput(buildWelcome(system));
    return () => {
      mountedRef.current = false;
    };
  }, [addOutput, system, initialCwd]);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [entries, input, busy]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = near;
    setAutoScroll(near);
  }, []);

  const processQueue = useCallback(async () => {
    if (busyRef.current) return;
    const cmd = queueRef.current.shift();
    if (cmd === undefined) return;
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    let res: ExecResult;
    try {
      res = await executeCommand(cmd, cwdRef.current);
    } catch {
      res = {
        stdout: "",
        stderr: "\x1b[31mcommand failed to execute\x1b[0m\n",
        code: 1,
        cwd: cwdRef.current,
      };
    }
    if (!mountedRef.current) return;
    busyRef.current = false;
    setBusy(false);
    onBusyChange(false);
    if (res.cwd && res.cwd !== cwdRef.current) {
      cwdRef.current = res.cwd;
      setCwd(res.cwd);
      onCwdChange(res.cwd);
    }
    if (res.stdout) addOutput(res.stdout);
    if (res.stderr) addOutput(res.stderr);
    if (res.timedOut) addOutput(`\x1b[33m[command timed out after 30s]\x1b[0m`);
    if (res.code !== 0 && !res.stdout && !res.stderr) {
      addOutput(`\x1b[31m[exit code ${res.code}]\x1b[0m`);
    }
    if (mountedRef.current) processQueue();
  }, [addOutput, onBusyChange, onCwdChange]);

  const applyCompletion = useCallback((val: string, comp: string): string => {
    if (!val.includes(" ")) return comp;
    const parts = val.split(/\s+/);
    parts[parts.length - 1] = comp;
    return parts.join(" ");
  }, []);

  const complete = useCallback(async () => {
    const cmd = input;
    if (!cmd.trim()) return;
    const { completions } = await suggest(cmd, cwdRef.current);
    if (completions.length === 0) return;
    if (completions.length === 1) {
      setInput(applyCompletion(cmd, completions[0].value));
    } else if (completions.length <= 24) {
      addOutput("\n" + completions.map((c) => c.value).join("   "));
    } else {
      addOutput(`\n\x1b[33m${completions.length} matches\x1b[0m`);
    }
  }, [input, applyCompletion, addOutput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      if (e.key === "Enter") {
        e.preventDefault();
        dispatch(input);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const h = historyRef.current;
        if (h.length === 0) return;
        const idx =
          historyIdxRef.current === -1
            ? h.length - 1
            : Math.max(0, historyIdxRef.current - 1);
        historyIdxRef.current = idx;
        setInput(h[idx]);
        el.setSelectionRange(h[idx].length, h[idx].length);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const h = historyRef.current;
        if (h.length === 0) return;
        if (historyIdxRef.current === -1 || historyIdxRef.current >= h.length - 1) {
          historyIdxRef.current = -1;
          setInput("");
        } else {
          historyIdxRef.current += 1;
          setInput(h[historyIdxRef.current]);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        void complete();
        return;
      }
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        addOutput(`\x1b[35m^C\x1b[0m`);
        setInput("");
        historyIdxRef.current = -1;
        return;
      }
      if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setEntries([]);
        return;
      }
      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        setInput("");
        return;
      }
      if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        setInput((v) => v.replace(/\S+\s*$/, ""));
        return;
      }
      if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (!input.trim()) {
          addOutput(buildExitMessage(system));
          setTimeout(onClose, 450);
        }
        return;
      }
      if (e.ctrlKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onNewSession();
        return;
      }
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        e.preventDefault();
        el.setSelectionRange(input.length, input.length);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, complete, addOutput, system, onClose, onNewSession],
  );

  const dispatch = useCallback(
    (raw: string) => {
      let cmd = raw.trim();
      if (!cmd) {
        addEntry({ id: idRef.current++, kind: "prompt", command: "" });
        return;
      }
      if (cmd === "!!") {
        const last = historyRef.current[historyRef.current.length - 1];
        if (last) cmd = last;
      }
      pushHistory(cmd);
      if (cmd === "clear" || cmd === "cls") {
        setEntries([]);
        return;
      }
      if (cmd === "help" || cmd === "--help" || cmd === "-h") {
        addEntry({ id: idRef.current++, kind: "prompt", command: cmd });
        addOutput(HELP_TEXT);
        return;
      }
      if (cmd === "history") {
        addEntry({ id: idRef.current++, kind: "prompt", command: cmd });
        addOutput(buildHistory(historyRef.current));
        return;
      }
      if (cmd === "exit" || cmd === "logout") {
        addEntry({ id: idRef.current++, kind: "prompt", command: cmd });
        addOutput(buildExitMessage(system));
        setTimeout(onClose, 500);
        return;
      }
      addEntry({ id: idRef.current++, kind: "prompt", command: cmd });
      queueRef.current.push(cmd);
      processQueue();
    },
    [addEntry, addOutput, pushHistory, processQueue, system, onClose],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val.includes("\n")) {
        const parts = val.split("\n");
        const last = parts[parts.length - 1];
        const toRun = parts.slice(0, -1).map((l) => l.trim());
        if (toRun.some(Boolean)) {
          queueRef.current.push(...toRun);
          processQueue();
        }
        setInput(last);
      } else {
        setInput(val);
      }
    },
    [processQueue],
  );

  return (
    <div className="term-body" onMouseUp={() => { if (!window.getSelection()?.toString()) focusInput(); }}>
      <div ref={scrollRef} className="term-scroll term-scrollbar" onScroll={handleScroll}>
        {entries.map((e) =>
          e.kind === "prompt" ? (
            <div className="term-line" key={e.id}>
              <Prompt system={system} cwd={cwd} />
              <span className="term-cmd">{e.command}</span>
            </div>
          ) : (
            <div className="term-line term-out" key={e.id}>
              <AnsiText text={e.text} />
            </div>
          ),
        )}
        <div className="term-line term-active-line">
          <Prompt system={system} cwd={cwd} />
          <span className="relative min-w-0 flex-1">
            <span className="term-cmd whitespace-pre">{input}</span>
            <span className={`term-cursor ${busy ? "term-cursor-busy" : ""}`} />
            <input
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="term-input"
              autoFocus
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="terminal input"
            />
          </span>
        </div>
        <div ref={bottomRef} className="h-px" />
      </div>
      {!autoScroll && (
        <button className="term-scroll-bottom" onClick={scrollToBottom} aria-label="scroll to bottom">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M8 1a.75.75 0 0 1 .75.75v9.69l2.97-2.97a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 9.53a.75.75 0 0 1 1.06-1.06l2.97 2.97V1.75A.75.75 0 0 1 8 1Z" />
          </svg>
          scroll to bottom
        </button>
      )}
    </div>
  );
}
