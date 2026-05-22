import { Building2, Landmark, Package, Check } from 'lucide-react';

export const STEPS = [
  { label: 'Company', icon: Building2 },
  { label: 'Bank Details', icon: Landmark },
  { label: 'Articles', icon: Package },
] as const;

interface Props {
  current: number;
}

export function Stepper({ current }: Props) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const completed = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-orange-500 text-white'
                  : completed
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 mx-1 ${
                  completed ? 'bg-orange-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
