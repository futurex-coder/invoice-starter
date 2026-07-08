import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Plus } from 'lucide-react';

export function EmptyDashboard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="h-14 w-14 text-gray-300 mb-4" />
        <h2 className="text-lg font-medium mb-2">Все още нямате фирми</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Създайте първата си фирма, за да започнете да издавате фактури и да следите приходите.
        </p>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white">
          <Link href="/create-company">
            <Plus className="mr-2 h-4 w-4" />
            Създайте първата си фирма
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
