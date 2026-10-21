"use client";

import Link from "next/link";
import UploadPanel from "@/components/UploadPanel";

export default function UploadPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <span>←</span>
          <span>Back to Timeline</span>
        </Link>
      </div>

      <UploadPanel />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-slate-500">
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-1">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span>✨</span>
            <span>Multi-Panel Detection</span>
          </p>
          <p>
            Upload single or multi-page PDFs. Combined panels (CBC + LFT + KFT) are auto-categorized under dedicated headers.
          </p>
        </div>
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-1">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span>✏️</span>
            <span>Instant Inline Editing</span>
          </p>
          <p>
            You can verify and edit any parsed value, reference range, or units directly on the report card anytime.
          </p>
        </div>
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-1">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span>🔒</span>
            <span>Private &amp; Secure</span>
          </p>
          <p>
            Your laboratory records remain in your private local storage, giving you full control over your personal health timeline.
          </p>
        </div>
      </div>
    </div>
  );
}

