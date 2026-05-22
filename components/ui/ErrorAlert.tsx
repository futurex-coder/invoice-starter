interface Props {
  message: string | null;
  className?: string;
}

export function ErrorAlert({ message, className }: Props) {
  if (!message) return null;
  return (
    <div className={`p-3 rounded-md bg-red-50 text-red-700 text-sm ${className ?? ''}`}>
      {message}
    </div>
  );
}
