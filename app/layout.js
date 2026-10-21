import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ReportsProvider } from "@/context/ReportsContext";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Health Timeline · Smart Lab Reports Manager",
  description: "Store, track, and compare your laboratory reports privately",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 flex flex-col justify-between">
        <AuthProvider>
          <ReportsProvider>
            <div>
              <Navbar />
              <main className="max-w-5xl mx-auto px-4 py-8">
                {children}
              </main>
            </div>
            <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400 print:hidden">
              <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
                <span>🧪 Health Timeline · All records stored in your browser&apos;s private local storage</span>
                <span>Not medical advice · For personal informational tracking</span>
              </div>
            </footer>
          </ReportsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
