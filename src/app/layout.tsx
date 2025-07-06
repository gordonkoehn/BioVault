import "./globals.css";
import { Inter } from "next/font/google";
import PrivyProvider from "@/components/PrivyProvider";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";
import PrivyLoginRedirect from "@/components/PrivyLoginRedirect";

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
          <nav className="w-full bg-white/90 backdrop-blur-sm font-sans shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
              <Link href="/">
                <span className="font-extrabold text-2xl tracking-tight font-sans text-[#0A3266]">BIOVAULT</span>
              </Link>
              <div className="flex-1 flex justify-center">
                <div className="flex gap-8">
                  <Link href="/submit-claim" className="text-gray-800 font-semibold text-base font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Submit Claim</Link>
                  <Link href="/insurance" className="text-gray-800 font-semibold text-base font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Insurance</Link>
                  <Link href="/zk-proof-demo" className="text-gray-800 font-semibold text-base font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Submit Health Report</Link>
                </div>
              </div>
              <div className="flex items-center ml-6">
                <LoginButton />
              </div>
            </div>
          </nav>
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}