import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhyDeltaZeroButton } from "@/components/why-deltazero-button";

export const metadata: Metadata = {
  title: "DeltaZero | Deterministic Risk Gate for Pseudo Delta Neutral DeFi",
  description: "DeltaZero is the deterministic risk gate for pseudo delta neutral DeFi positions. Measure hedge drift, carry deterioration, funding stress, Safety Buffer breach probability, and Monte Carlo impairment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("deltazero-theme");var t=s==="light"||s==="dark"?s:"dark";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <WhyDeltaZeroButton />
      </body>
    </html>
  );
}
