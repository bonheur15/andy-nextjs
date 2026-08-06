import { getSystemInfo } from "./action";
import { TerminalApp } from "./components/terminal-app";

export default async function Home() {
  const system = await getSystemInfo();
  return (
    <main className="term-main">
      <TerminalApp system={system} initialCwd={system.home} />
    </main>
  );
}
