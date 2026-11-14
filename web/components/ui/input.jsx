import { cn } from "cn";

const inputClasses = [
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition",
  "placeholder:text-ink-muted",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-muted",
  "aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20",
].join(" ");

function Input({ className, ...props }) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export { Input, inputClasses };
