import type { SystemInfo } from "../action";

const R = "\x1b[0m";

export function buildWelcome(s: SystemInfo): string {
  const homeName = s.home;
  const lines = [
    `${R}${"\x1b[1;32m"}     _                     _ ${R}`,
    `${R}${"\x1b[1;32m"}    / \\   _ __   __ _ _ __(_) __ _   _ ${R}`,
    `${R}${"\x1b[1;32m"}   / _ \\ | '_ \\ / _\` | '__| |/ _\` | | | ${R}`,
    `${R}${"\x1b[1;32m"}  / ___ \\| | | | (_| | |  | | (_| | |_| ${R}`,
    `${R}${"\x1b[1;32m"} /_/   \\_\\_| |_|\\__,_|_|  |_|\\__,_|\\__, ${R}`,
    `${R}${"\x1b[1;32m"}                                    |___/ ${R}`,
    ``,
    `${R}${"\x1b[1;36m"}────────────────────────────────────────────────────────${R}`,
    `\x1b[1;37m${s.user}@${s.hostname}${R}`,
    `\x1b[1;33mOS:${R}       \x1b[37m${s.platform} ${s.kernel}${R}`,
    `\x1b[1;33mArch:${R}     \x1b[37m${s.arch}${R}`,
    `\x1b[1;33mShell:${R}    \x1b[37m${s.shell}${R}`,
    `\x1b[1;33mHome:${R}     \x1b[37m${homeName}${R}`,
    `\x1b[1;33mSession:${R}  \x1b[37minteractive — bash in the browser${R}`,
    `${R}${"\x1b[1;36m"}────────────────────────────────────────────────────────${R}`,
    `Type \x1b[1;32mhelp${R} for commands, \x1b[1;32mTab${R} to autocomplete, \x1b[1;32mCtrl+K${R} for a new session.`,
    ``,
  ];
  return lines.join("\n");
}

export const HELP_TEXT = [
  `\x1b[1;36m┌──────────────────────────────────────────────────────────────┐${R}`,
  `\x1b[1;36m│${R}  \x1b[1;37mANDY TERMINAL${R}  ·  \x1b[1;33mv1.0${R}  ·  \x1b[1;36mbash over the wire${R}        \x1b[1;36m│${R}`,
  `\x1b[1;36m└──────────────────────────────────────────────────────────────┘${R}`,
  ``,
  `\x1b[1;33mBuilt-in commands:${R}`,
  `  \x1b[1;32mclear\x1b[0m  cls        clear the screen`,
  `  \x1b[1;32mhelp${R}               this help`,
  `  \x1b[1;32mhistory${R}            session command history`,
  `  \x1b[1;32mexit\x1b[0m  logout    close the current session`,
  ``,
  `\x1b[1;33mServer commands:${R}`,
  `  Anything else runs through \x1b[1;37mbash\x1b[0m on the backend.`,
  `  Try: \x1b[1;32mls\x1b[0m · \x1b[1;32mpwd\x1b[0m · \x1b[1;32mcd\x1b[0m · \x1b[1;32mcat\x1b[0m · \x1b[1;32mwhoami\x1b[0m · \x1b[1;32muname -a\x1b[0m`,
  `       \x1b[1;32mdf -h\x1b[0m · \x1b[1;32mfree -m\x1b[0m · \x1b[1;32mps aux\x1b[0m · \x1b[1;32mcurl ifconfig.me\x1b[0m`,
  ``,
  `\x1b[1;33mKeyboard shortcuts:${R}`,
  `  \x1b[1;32mTab${R}          autocomplete commands & paths`,
  `  \x1b[1;32m↑  /  ↓${R}      browse command history`,
  `  \x1b[1;32mCtrl + C${R}     cancel the current line`,
  `  \x1b[1;32mCtrl + L${R}     clear the screen`,
  `  \x1b[1;32mCtrl + U${R}     clear the current line`,
  `  \x1b[1;32mCtrl + D${R}     close the session`,
  `  \x1b[1;32mCtrl + K${R}     open a new session`,
  `  \x1b[1;32mShift + PgUp\x1b[0m/PageDn   scroll`,
].join("\n");

export function buildHistory(list: string[]): string {
  if (list.length === 0) return "\x1b[33mhistory is empty\x1b[0m";
  const width = String(list.length).length;
  return list
    .map((cmd, i) => `${String(i + 1).padStart(width)}  \x1b[37m${cmd}\x1b[0m`)
    .join("\n");
}

export function buildExitMessage(s: SystemInfo): string {
  return `\x1b[35mlogout\x1b[0m  — closing ${s.user}@${s.hostname}`;
}
