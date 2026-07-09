'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRightLeft, Trash2 } from 'lucide-react';

interface Props {
  onTransferClick: () => void;
  onDeleteClick: () => void;
}

export function DangerZoneCard({ onTransferClick, onDeleteClick }: Props) {
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">Опасна зона</CardTitle>
        <CardDescription>Необратими действия. Действайте внимателно.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium">Прехвърляне на собствеността</p>
            <p className="text-xs text-muted-foreground">
              Прехвърлете тази фирма на друг член. Вие ще станете счетоводител.
            </p>
          </div>
          <Button variant="outline" onClick={onTransferClick}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Прехвърли
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 p-4">
          <div>
            <p className="text-sm font-medium text-red-700">Изтриване на фирмата</p>
            <p className="text-xs text-muted-foreground">
              Изтрива фирмата обратимо. Всички членове губят достъп. Можете да я възстановите по-късно.
            </p>
          </div>
          <Button variant="destructive" onClick={onDeleteClick}>
            <Trash2 className="mr-2 h-4 w-4" />
            Изтрий
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
