import "./globals.css";
import { Montserrat } from "next/font/google";
import PrivyProvider from "@/components/PrivyProvider";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";
import PrivyLoginRedirect from "@/components/PrivyLoginRedirect";
import Image from "next/image";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

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
      <body className={montserrat.className + " bg-white text-black"}>
        <PrivyProvider>
          <PrivyLoginRedirect />
          <nav className="w-full bg-white/90 backdrop-blur-sm mb-8 font-sans shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/">
                <span className="font-extrabold text-3xl tracking-tight font-sans text-[#0A3266]">BIOVAULT</span>
              </Link>
              <div className="flex-1 flex justify-center">
                <div className="flex gap-10">
                  <Link href="/submit-claim" className="text-gray-800 font-semibold text-lg font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Submit Claim</Link>
                  <Link href="/insurance" className="text-gray-800 font-semibold text-lg font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Insurance</Link>
                  <Link href="/zk-proof-demo" className="text-gray-800 font-semibold text-lg font-sans hover:text-[#0A3266] transition px-2 py-1 rounded hover:bg-gray-100">Submit Invoice</Link>
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