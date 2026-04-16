import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "微信消息中转站 · WeChat Relay",
  description: "接收、管理并批量提交从微信群聊中抓取的人员信息",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
