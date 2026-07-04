import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={copy.locale} className="h-full antialiased">
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
