import Image from "next/image";
import { getIp } from "./action";

export default async function Home() {
  const ip = await getIp();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div>{ip}</div>
      <div>Hello world</div>
    </div>
  );
}
const dynamic = "force-dynamic";
