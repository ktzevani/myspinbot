import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "MySpinBot Console",
  description: "Phase 1 — Train → Generate (LoRA)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-gray-900">
        <header className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
            <Image src="/logo.svg" alt="MySpinBot" width={28} height={28} />
            <h1 className="text-lg font-semibold">MySpinBot — Phase 1</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
          {children}
        </main>
      </body>
    </html>
  );
}
