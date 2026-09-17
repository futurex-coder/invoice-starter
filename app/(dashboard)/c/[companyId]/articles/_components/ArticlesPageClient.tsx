'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  type ListResult,
} from '@/src/features/invoicing/actions';
import type { CreateArticleInput } from '@/src/features/invoicing/schemas';
import type { Article } from '@/lib/db/schema';
import { useListPageState } from '@/lib/swr/use-list-page-state';
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { SearchBar } from '@/components/list-page/SearchBar';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ArticleFormCard,
  emptyArticleForm,
  isArticleType,
  type ArticleForm,
} from './ArticleForm';
import { ArticlesTable } from './ArticlesTable';
import { PageShell } from '@/components/page-shell';

function articleToForm(a: Article): ArticleForm {
  const rawType = a.type ?? 'service';
  return {
    name: a.name,
    unit: a.unit,
    tags: a.tags ?? '',
    defaultUnitPrice: a.defaultUnitPrice ?? '0',
    currency: a.currency,
    type: isArticleType(rawType) ? rawType : 'service',
  };
}

function formToInput(f: ArticleForm): CreateArticleInput {
  return {
    name: f.name,
    unit: f.unit || 'бр.',
    tags: f.tags || undefined,
    defaultUnitPrice: Number(f.defaultUnitPrice) || 0,
    currency: f.currency || 'EUR',
    type: f.type,
  };
}

export function ArticlesPageClient({
  fallbackData,
}: {
  fallbackData?: ListResult<Article>;
}) {
  const list = useListPageState({
    swrKey: 'articles',
    defaults: { search: '' },
    fallbackData,
    action: ({ search, page, pageSize }) =>
      listArticles({ search: search || undefined, page, pageSize }),
  });

  const items = list.result?.items ?? [];
  const total = list.result?.total ?? 0;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyArticleForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const handleFormChange = (patch: Partial<ArticleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyArticleForm);
    setShowForm(true);
    list.setActionError(null);
    list.setActionValidationErrors(null);
  };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    setForm(articleToForm(a));
    setShowForm(true);
    list.setActionError(null);
    list.setActionValidationErrors(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyArticleForm);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const input = formToInput(form);
      if (editingId) {
        await list.runMutation(() => updateArticle(editingId, input));
      } else {
        await list.runMutation(() => createArticle(input));
      }
      closeForm();
    } catch {
      // runMutation already set actionError; keep the form open
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    await list.runMutation(() => deleteArticle(confirmDelete.id));
  };

  return (
    <PageShell>
      <ListPageHeader
        title="Артикули"
        action={
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Добави артикул
          </Button>
        }
      />

      <ErrorAlert message={list.error} className="mb-4" />

      {showForm && (
        <ArticleFormCard
          isEditing={editingId != null}
          form={form}
          onFormChange={handleFormChange}
          saving={saving}
          onSave={handleSave}
          onCancel={closeForm}
          validationErrors={list.actionValidationErrors}
        />
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <SearchBar
            value={list.searchInput}
            onChange={list.setSearchInput}
            onSubmit={list.commitSearch}
            placeholder="Търсене по име..."
          />
        </CardContent>
      </Card>

      <ListCard
        title="Списък с артикули"
        count={total}
        loading={list.loading}
        isEmpty={!items.length}
        emptyMessage='Няма намерени артикули. Добавете с „Добави артикул“.'
        page={list.page}
        pageSize={list.pageSize}
        total={total}
        onPageChange={list.setPage}
      >
        <ArticlesTable
          articles={items}
          onEdit={openEdit}
          onDelete={(a) => setConfirmDelete({ id: a.id, name: a.name })}
        />
      </ListCard>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Изтриване на артикул?"
        description={
          confirmDelete
            ? `${confirmDelete.name} ще бъде премахнат завинаги. Това действие е необратимо.`
            : undefined
        }
        confirmText="Изтрий"
        variant="destructive"
        onConfirm={handleDeleteConfirmed}
      />
    </PageShell>
  );
}
