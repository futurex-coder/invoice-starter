import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  notes: string | null;
}

export function NotesCard({ notes }: Props) {
  if (!notes) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Бележки</CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
        {notes}
      </CardContent>
    </Card>
  );
}
