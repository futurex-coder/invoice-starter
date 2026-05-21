'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from '@/src/features/invoicing/actions';
import type { CreateArticleInput } from '@/src/features/invoicing/schemas';
import type { Article } from '@/lib/db/schema';
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { SearchBar } from '@/components/list-page/SearchBar';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArticleFormCard,
  emptyArticleForm,
  type ArticleForm,
} from './_components/ArticleForm';
import { ArticlesTable } from './_components/ArticlesTable';

function articleToForm(a: Article): ArticleForm {
  return {
    name: a.name,
    unit: a.unit,
    tags: a.tags ?? '',
    defaultUnitPrice: a.defaultUnitPrice ?? '0',
    currency: a.currency,
    type: a.type ?? 'service',
  };
}

function formToInput(f: ArticleForm): CreateArticleInput {
  return {
    name: f.name,
    unit: f.unit || 'бр.',
    tags: f.tags || undefined,
    defaultUnitPrice: Number(f.defaultUnitPrice) || 0,
    currency: f.currency || 'EUR',
    type: (f.type as 'service' | 'goods') || undefined,
  };
}

export default function ArticlesPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [items, setItems] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyArticleForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listArticles({
      search: search || undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
  }, [search, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(); // async data fetch — setState calls are intentional side effects
  }, [fetchData]);

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
    setError(null);
  };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    setForm(articleToForm(a));
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyArticleForm);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const input = formToInput(form);

    if (editingId) {
      const res = await updateArticle(editingId, input);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        return;
      }
    } else {
      const res = await createArticle(input);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        return;
      }
    }

    closeForm();
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    setError(null);
    const res = await deleteArticle(id);
    if (res.error) setError(res.error);
    else fetchData();
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <ListPageHeader
        title="Articles"
        action={
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={openCreate}>
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
    </section>
  );
}
