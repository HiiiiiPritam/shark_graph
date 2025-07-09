import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto flex flex-col items-center my-auto">
        <h1>Welcome to Lab Simulator</h1>
      <Link href="/lab">Go To Lab</Link>
      </div>
    </div>
  );
}
