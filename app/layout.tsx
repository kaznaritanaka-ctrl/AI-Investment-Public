import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Investment Research — AIの経済を、観測する。",
  description: "AIの価格、条件、変化の履歴を観測する独立データリサーチ。出典と文脈を残し、投資家とAIエージェントが使える情報の土台をつくります。",
  metadataBase: new URL("https://ai-investment-research.kaznaritanaka.chatgpt.site"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
