"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReports } from "@/context/ReportsContext";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";

export default function Navbar() {
  const pathname = usePathname();
  const {
    reports,
    loading,
    isSyncing,
    lastSynced,
    syncWithServer,
    clearAllReports,
    loadDemoReports,
  } = useReports();
  const { user, isGuest, openAuthModal, signOut } = useAuth();

  const navLinks = [
    { href: "/", label: "Timeline", icon: "📋", count: reports.length },
    { href: "/upload", label: "Upload", icon: "📤" },
    { href: "/compare", label: "Compare", icon: "📈" },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl sm:text-2xl p-1 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                🧪
              </span>
              <div>
                <span className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                  Health Timeline
                </span>
                <p className="text-[11px] text-slate-500 hidden md:block">
                  Smart biomarker tracking &amp; report comparison
                </p>
              </div>
            </Link>
          </div>

          {/* User Auth, Sync & Data Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 order-2 sm:order-3">
            {user ? (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 py-1 px-2 rounded-xl text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                    {user.name ? user.name[0].toUpperCase() : "U"}
                  </span>
                  <span
                    className="font-semibold text-slate-800 max-w-[75px] sm:max-w-[110px] truncate"
                    title={user.email}
                  >
                    {user.name || user.email.split("@")[0]}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-slate-400 hover:text-red-600 ml-0.5 font-semibold p-0.5"
                    title="Sign out"
                  >
                    ✕
                  </button>
                </div>

                {/* Explicit Sync Button for Logged-In User */}
                <button
                  onClick={() => syncWithServer()}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-60"
                  title={
                    lastSynced
                      ? `Last synced: ${new Date(lastSynced).toLocaleTimeString()} · Click to re-sync across devices`
                      : "Click to sync reports with server"
                  }
                >
                  <span className={`text-xs ${isSyncing ? "animate-spin text-blue-600 inline-block" : ""}`}>
                    🔄
                  </span>
                  <span className="hidden sm:inline">
                    {isSyncing ? "Syncing…" : "Sync"}
                  </span>
                </button>
              </>
            ) : (
              <button
                onClick={openAuthModal}
                className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                title="Sign in with Google or Demo Account to sync across laptop & phone"
              >
                <span>☁️</span>
                <span className="hidden xs:inline">Sign In / </span>Sync
              </button>
            )}

            {/* Clear All Data / Load Demo Action */}
            {reports.length > 0 ? (
              <button
                onClick={clearAllReports}
                className="text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-red-50 transition-colors"
                title="Clear all reports from database and browser"
              >
                <span>🗑️</span> <span className="hidden sm:inline">Clear</span>
              </button>
            ) : (
              <button
                onClick={loadDemoReports}
                className="text-xs text-slate-500 hover:text-blue-600 px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-blue-50 transition-colors"
                title="Load sample demo data (CBC, LFT)"
              >
                <span>🧪</span> <span className="hidden sm:inline">Sample Data</span>
              </button>
            )}
          </div>

          {/* Navigation Tabs (Full width on mobile, inline on tablet/desktop) */}
          <nav className="w-full sm:w-auto order-3 sm:order-2 flex items-center justify-around sm:justify-start gap-1 bg-slate-100/90 p-1 rounded-xl">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-blue-600 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count != null && !loading && (
                    <span
                      className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
        </div>
      </header>

      {/* Global Auth Modal */}
      <AuthModal />
    </>
  );
}
