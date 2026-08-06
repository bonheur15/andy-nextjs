"use server";

import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { readdir, stat, realpath } from "node:fs/promises";

const execAsync = promisify(exec);
const HOME = process.env.HOME || "/";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 250_000;
const MAX_STDOUT_BYTES = 8 * 1024 * 1024;

export type SystemInfo = {
  user: string;
  hostname: string;
  platform: string;
  kernel: string;
  arch: string;
  home: string;
  shell: string;
};

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  cwd: string;
  timedOut?: boolean;
};

export type Completion = {
  value: string;
  isDir?: boolean;
};

export async function getSystemInfo(): Promise<SystemInfo> {
  return {
    user: os.userInfo().username || "root",
    hostname: os.hostname() || "localhost",
    platform: os.type() || "Linux",
    kernel: os.release() || "",
    arch: os.arch() || "",
    home: HOME,
    shell: process.env.SHELL || "/bin/bash",
  };
}

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  return (
    s.slice(0, MAX_OUTPUT_CHARS) +
    `\n\x1b[33m… output truncated (${s.length.toLocaleString()} characters)\x1b[0m\n`
  );
}

async function safeCwd(cwd?: string): Promise<string> {
  if (cwd) {
    try {
      const st = await stat(cwd);
      if (st.isDirectory()) return cwd;
    } catch {
      /* fall through */
    }
  }
  return HOME;
}

function colorizeLs(command: string): string {
  const m = command.trim().match(/^(\b(?:ls|dir|grep|rg)\b)(\s|$)/);
  if (m && !/\b--color(?:=always)?\b/.test(command)) {
    return command.replace(/^(\b(?:ls|dir|grep|rg)\b)/, `$1 --color=always`);
  }
  return command;
}

async function resolveCd(base: string, target: string): Promise<{ cwd: string; error?: string }> {
  const next = target ? path.resolve(base, target) : HOME;
  try {
    const st = await stat(next);
    if (!st.isDirectory()) {
      return { cwd: base, error: `bash: cd: ${target || "~"}: Not a directory` };
    }
    return { cwd: await realpath(next) };
  } catch {
    return { cwd: base, error: `bash: cd: ${target || "~"}: No such file or directory` };
  }
}

export async function executeCommand(command: string, cwd: string): Promise<ExecResult> {
  const base = await safeCwd(cwd);
  const trimmed = command.trim();

  if (/^cd\b/.test(trimmed) && !/[;&|>\n]/.test(trimmed)) {
    const target = trimmed.replace(/^cd\s*/, "").replace(/^~/, HOME);
    const { cwd: next, error } = await resolveCd(base, target);
    if (error) {
      return { stdout: "", stderr: error + "\n", code: 1, cwd: base };
    }
    return { stdout: "", stderr: "", code: 0, cwd: next };
  }

  const wrapped = colorizeLs(trimmed);

  try {
    const { stdout, stderr } = await execAsync(wrapped, {
      cwd: base,
      shell: "/bin/bash",
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_STDOUT_BYTES,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        FORCE_COLOR: "1",
        PS1: "$ ",
      },
    });
    return {
      stdout: truncate(String(stdout ?? "")),
      stderr: truncate(String(stderr ?? "")),
      code: 0,
      cwd: base,
    };
  } catch (err) {
    const e = err as {
      code?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      killed?: boolean;
      signal?: string;
    };
    return {
      stdout: truncate(String(e.stdout ?? "")),
      stderr: truncate(String(e.stderr ?? "")),
      code: typeof e.code === "number" ? e.code : 1,
      cwd: base,
      timedOut: Boolean(e.killed && e.signal === "SIGTERM"),
    };
  }
}

const BUILTINS = [
  "cd",
  "clear",
  "cls",
  "help",
  "history",
  "exit",
  "logout",
  "pwd",
  "echo",
  "ls",
  "dir",
  "cat",
  "head",
  "tail",
  "less",
  "mkdir",
  "touch",
  "rm",
  "cp",
  "mv",
  "grep",
  "find",
  "whoami",
  "hostname",
  "uname",
  "date",
  "uptime",
  "df",
  "du",
  "free",
  "ps",
  "top",
  "kill",
  "chmod",
  "chown",
  "curl",
  "wget",
  "tar",
  "zip",
  "unzip",
  "git",
  "node",
  "npm",
  "bun",
  "npx",
  "pnpm",
  "python3",
  "pip",
  "cargo",
  "go",
  "rustc",
  "make",
  "man",
  "which",
  "sudo",
  "env",
  "export",
  "source",
  "alias",
  "nano",
  "vim",
  "vi",
];

export async function suggest(
  input: string,
  cwd: string,
): Promise<{ completions: Completion[]; isDir: boolean }> {
  const base = await safeCwd(cwd);
  const trimmed = input.replace(/\s+$/, "");
  const parts = trimmed.split(/\s+/);

  if (parts.length <= 1) {
    const q = (parts[0] ?? "").toLowerCase();
    const fromBuiltins = BUILTINS.filter((b) => b.startsWith(q) && b !== q).slice(0, 24);
    return { completions: fromBuiltins.map((value) => ({ value })), isDir: false };
  }

  const last = parts[parts.length - 1] ?? "";
  const dirPart = last.includes("/") ? path.dirname(last) : ".";
  const namePart = path.basename(last);
  try {
    const entries = await readdir(path.resolve(base, dirPart), { withFileTypes: true });
    const matches = entries
      .filter((e) => e.name.startsWith(namePart) && e.name !== namePart)
      .slice(0, 24)
      .map((e) => {
        const isDir = e.isDirectory();
        const prefix = last.slice(0, last.length - namePart.length);
        return { value: prefix + e.name + (isDir ? "/" : ""), isDir };
      });
    return { completions: matches, isDir: false };
  } catch {
    return { completions: [], isDir: false };
  }
}
