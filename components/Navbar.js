"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReports } from "@/context/ReportsContext";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";

export default function Navbar() {
  const pathname = usePathname();
  const { reports, resetToDemo, loading } = useReports();
  const { user, isGuest, openAuthModal, signOut } = useAuth();

  const navLinks = [
    { href: "/", label: "Timeline", icon: "📋", count: reports.length },
    { href: "/upload", label: "Upload Report", icon: "📤" },
    { href: "/compare", label: "Compare Trends", icon: "📈" },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl p-1 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                🧪
              </span>
              <div>
                <span className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                  Health Timeline
                </span>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Smart biomarker tracking &amp; report comparison
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count != null && !loading && (
                    <span
                      className={`ml-1 text-xs px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-xl text-xs">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </span>
                <span className="font-semibold text-slate-800 max-w-[100px] truncate" title={user.email}>
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                  ☁️ Synced
                </span>
                <button
                  onClick={signOut}
                  className="text-slate-400 hover:text-red-600 ml-1 font-semibold"
                  title="Sign out"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>☁️</span>
                <span>Sign In / Sync</span>
              </button>
            )}

            <button
              onClick={resetToDemo}
              className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              title="Reload sample demo reports"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Global Auth Modal */}
      <AuthModal />
    </>
  );
}
