"use client";

interface StatusMessageProps {
  type: "success" | "error" | null;
  message: string;
  variant?: "info" | "default";
}

const successIcon = (
  <svg className="text-success h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

const mutedSuccessIcon = (
  <svg
    className="text-muted-foreground h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

const errorIcon = (
  <svg className="text-error h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
      clipRule="evenodd"
    />
  </svg>
);

export function StatusMessage({
  type,
  message,
  variant = "default",
}: StatusMessageProps) {
  if (!type) return null;

  const isSuccess = type === "success";
  const bgClass = isSuccess
    ? variant === "info"
      ? "bg-muted/50 border-muted"
      : "bg-success/10 border-success/20"
    : "bg-error/10 border-error/20";
  const textClass = isSuccess
    ? variant === "info"
      ? "text-muted-foreground"
      : "text-success-foreground"
    : "text-error-foreground";
  const icon = isSuccess
    ? variant === "info"
      ? mutedSuccessIcon
      : successIcon
    : errorIcon;

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-3">
          <p className={`text-sm font-medium ${textClass}`}>{message}</p>
        </div>
      </div>
    </div>
  );
}
