'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from '@/src/features/invoicing/actions';
import type { CreateArticleInput } from '@/src/features/invoicing/schemas';
import type { Article } from '@/lib/db/schema';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { SearchBar } from '@/components/list-page/SearchBar';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArticleFormCard,
  emptyArticleForm,
  isArticleType,
  type ArticleForm,
} from './_components/ArticleForm';
import { ArticlesTable } from './_components/ArticlesTable';
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

export default function ArticlesPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    data: result,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(
    ['articles', search, page],
    () => listArticles({ search: search || undefined, page, pageSize })
  );

  const items = result?.items ?? [];
  const total = result?.total ?? 0;

  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (fetchError ? fetchError.message : null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyArticleForm);
  const [saving, setSaving] = useState(false);

  const handleFormChange = (patch: Partial<ArticleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyArticleForm);
    setShowForm(true);
    setActionError(null);
  };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    setForm(articleToForm(a));
    setShowForm(true);
    setActionError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyArticleForm);
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    const input = formToInput(form);

    if (editingId) {
      const res = await updateArticle(editingId, input);
      setSaving(false);
      if (res.error) {
        setActionError(res.error);
        return;
      }
    } else {
      const res = await createArticle(input);
      setSaving(false);
      if (res.error) {
        setActionError(res.error);
        return;
      }
    }

    closeForm();
    refetch();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    setActionError(null);
    const res = await deleteArticle(id);
    if (res.error) setActionError(res.error);
    else refetch();
  };

  return (
    <PageShell>
      <ListPageHeader
        title="Articles"
        action={
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add article
          </Button>
        }
      />

      <ErrorAlert message={error} className="mb-4" />

      {showForm && (
        <ArticleFormCard
          isEditing={editingId != null}
          form={form}
          onFormChange={handleFormChange}
          saving={saving}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={applySearch}
            placeholder="Search by name..."
          />
        </CardContent>
      </Card>

      <ListCard
        title="Article list"
        count={total}
        loading={loading}
        isEmpty={!items.length}
        emptyMessage='No articles found. Add one with "Add article".'
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      >
        <ArticlesTable
          articles={items}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </ListCard>
    </PageShell>
  );
}
