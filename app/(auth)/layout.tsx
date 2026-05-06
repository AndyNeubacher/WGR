export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
