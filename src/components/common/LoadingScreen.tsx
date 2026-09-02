import React from "react";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 gap-4">
      <div className="w-10 h-10 border-4 border-neutral-700 border-t-amber-500 rounded-full animate-spin" />
      {message && <p className="text-neutral-400 text-sm">{message}</p>}
    </div>
  );
}