interface Props {
  label: string;
  value: number;
}

export function BreakdownRow({ label, value }: Props) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
