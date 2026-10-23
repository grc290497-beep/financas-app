import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/nav/site-footer";
import { PwaSetup } from "@/components/pwa/install-app";
import { Toaster } from "@/components/ui/sonner";
import { PRIVACY_SCRIPT } from "@/lib/privacy";
import { publicSiteOrigin } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    // Absolute URLs for the link preview (opengraph-image.tsx).
    metadataBase: new URL(publicSiteOrigin()),
    title: t("title"),
    description: t("description"),
    appleWebApp: { capable: true, title: t("title"), statusBarStyle: "default" },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: t("title"),
      title: t("ogTitle"),
      description: t("description"),
    },
    twitter: { card: "summary_large_image", title: t("ogTitle"), description: t("description") },
  };
}

// Matches --background in light and dark (globals.css), so the browser chrome blends in.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1512" },
  ],
  viewportFit: "cover",
  // Android Chrome shrinks the layout for the keyboard, so sheets stay usable.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    // next-themes sets the class on <html> before hydration.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* "Esconder valores" before the first paint (lib/privacy.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PRIVACY_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider>
            {children}
            <SiteFooter />
            <Toaster />
            <PwaSetup />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
