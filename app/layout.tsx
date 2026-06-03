import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "SEO Scout Workbench",
  description: "クラウドソーシングSEO/GEO案件の発見・解析・提案・納品を一気通貫で支援する実務ワークベンチ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <main className="mx-auto max-w-[1180px] px-7 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
