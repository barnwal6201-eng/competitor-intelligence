export function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-slate-200/50 text-sm text-slate-500">
      <p>
        Already have an account?{" "}
        <a href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </a>{" "}
        to your workspace.
      </p>
    </footer>
  );
}