"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useReports } from "@/context/ReportsContext";

export default function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    user,
    isGoogleConfigured,
    signInWithGoogle,
    signInDemo,
    continueAsGuest,
  } = useAuth();

  const { reports, claimLocalReports } = useReports();
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [showManualDemo, setShowManualDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  if (!authModalOpen) return null;

  async function handleDemoLogin(email, name) {
    setBusy(true);
    try {
      await signInDemo(email, name);
      if (reports.length > 0) {
        setSyncMsg(`Syncing ${reports.length} local reports to your account…`);
        await claimLocalReports();
      }
      closeAuthModal();
    } catch (e) {
      alert("Sign-in failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-6 relative">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-full hover:bg-slate-100"
          title="Close"
        >
          ✕
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl shadow-sm">
            🧪
          </div>
          <h2 className="text-xl font-bold text-slate-900">Sign in to Health Timeline</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Sync your lab reports across your laptop and phone, so your medical history is ready at the doctor&apos;s clinic.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 flex items-center gap-2">
            <span>📱</span>
            <span>Phone ready at clinic</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 flex items-center gap-2">
            <span>☁️</span>
            <span>Cloud backup</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {/* Google Sign In Button */}
          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-xl shadow-sm transition-all text-sm hover:border-slate-400"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {!isGoogleConfigured && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <span>💡</span>
                <span>Testing / Demo Mode Active</span>
              </p>
              <p className="text-amber-700">
                Google OAuth keys are not yet configured in <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code>. You can test cross-device sync immediately with one-click:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDemoLogin("doctor.ahsan@example.com", "Dr. Ahsan")}
                  disabled={busy}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  Sign in as Dr. Ahsan
                </button>
                <button
                  onClick={() => setShowManualDemo(!showManualDemo)}
                  className="bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg text-xs hover:bg-amber-100"
                >
                  Custom Email…
                </button>
              </div>

              {showManualDemo && (
                <div className="pt-2 space-y-2">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Enter any test email (e.g. john@example.com)"
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Full name (optional)"
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                  <button
                    onClick={() => handleDemoLogin(customEmail, customName)}
                    disabled={!customEmail || busy}
                    className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    Sign In with this Email
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="relative py-1 text-center">
            <span className="bg-white px-2 text-xs text-slate-400">or</span>
            <div className="absolute inset-y-1/2 left-0 right-0 border-t border-slate-200 -z-10" />
          </div>

          {/* Continue as Guest Button */}
          <button
            onClick={continueAsGuest}
            disabled={busy}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors text-center"
          >
            Continue as Guest (Store in this browser only)
          </button>
        </div>

        {reports.length > 0 && (
          <p className="text-center text-xs text-emerald-600">
            ✓ Your {reports.length} local report{reports.length > 1 ? "s" : ""} will automatically link to your account when you sign in.
          </p>
        )}
      </div>
    </div>
  );
}

