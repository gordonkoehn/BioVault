import "./globals.css";
import { Inter } from "next/font/google";
import PrivyProvider from "@/components/PrivyProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "BioVault",
  description: "Upload biometric data and generate ZK proofs for private identity and insurance claims",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-white text-black"}>
        <PrivyProvider>
          <nav className="w-full border-b bg-white mb-8">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-xl tracking-tight">BioVault</span>
              <div className="flex gap-6">
                <a href="/" className="text-gray-700 hover:text-black font-medium transition">Claims</a>
                <a href="/submit-claim" className="text-gray-700 hover:text-black font-medium transition">Submit Claim</a>
                <a href="/insurance" className="text-gray-700 hover:text-black font-medium transition">Insurance</a>
              </div>
            </div>
          </nav>
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
