'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from '@/src/features/invoicing/actions';
import type { CreateArticleInput } from '@/src/features/invoicing/schemas';
import type { Article } from '@/lib/db/schema';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
} from 'lucide-react';

interface ArticleForm {
  name: string;
  unit: string;
  tags: string;
  defaultUnitPrice: string;
  currency: string;
  type: string;
}

const emptyForm: ArticleForm = {
  name: '',
  unit: 'бр.',
  tags: '',
  defaultUnitPrice: '0',
  currency: 'EUR',
  type: 'service',
};

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

const TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  goods: 'Goods',
};

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
  const [form, setForm] = useState<ArticleForm>(emptyForm);
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
    fetchData();
  }, [fetchData]);

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
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
    setForm(emptyForm);
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

  const totalPages = Math.ceil(total / pageSize);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Articles</h1>
        <Button
          className="bg-orange-500 hover:bg-orange-600"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add article
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {editingId ? 'Edit article' : 'New article'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aName">Name *</Label>
                <Input
                  id="aName"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Article name"
                />
              </div>
              <div>
                <Label htmlFor="aUnit">Unit *</Label>
                <Input
                  id="aUnit"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  placeholder="бр."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="aPrice">Default price</Label>
                <Input
                  id="aPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultUnitPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      defaultUnitPrice: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="aCurrency">Currency</Label>
                <select
                  id="aCurrency"
                  className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                >
                  <option value="EUR">EUR</option>
                  <option value="BGN">BGN</option>
                </select>
              </div>
              <div>
                <Label htmlFor="aType">Type</Label>
                <select
                  id="aType"
                  className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="service">Service</option>
                  <option value="goods">Goods</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="aTags">Tags</Label>
              <Input
                id="aTags"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="comma-separated tags (optional)"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="Search by name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
            <Button variant="outline" onClick={applySearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Article list{' '}
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                ({total})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !items.length ? (
            <p className="px-6 py-8 text-muted-foreground text-sm">
              No articles found. Add one with &quot;Add article&quot;.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Default Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-200 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {a.name}
                      {a.tags && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {a.tags}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{a.unit}</td>
                    <td className="px-4 py-3 text-sm">
                      {Number(a.defaultUnitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">{a.currency}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {TYPE_LABELS[a.type ?? 'service'] ?? a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(a)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(a.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
