'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  lookupCompanyByEik,
} from '@/src/features/invoicing/actions';
import type { CreatePartnerInput } from '@/src/features/invoicing/schemas';
import type { Partner, Company } from '@/lib/db/schema';
import { useCompany } from '@/lib/context/company-context';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
  Link2,
} from 'lucide-react';

interface PartnerForm {
  name: string;
  eik: string;
  vatNumber: string;
  isIndividual: boolean;
  country: string;
  city: string;
  street: string;
  postCode: string;
  mol: string;
  linkedCompanyId: number | null;
}

const emptyForm: PartnerForm = {
  name: '',
  eik: '',
  vatNumber: '',
  isIndividual: false,
  country: 'BG',
  city: '',
  street: '',
  postCode: '',
  mol: '',
  linkedCompanyId: null,
};

function partnerToForm(p: Partner): PartnerForm {
  return {
    name: p.name,
    eik: p.eik,
    vatNumber: p.vatNumber ?? '',
    isIndividual: p.isIndividual,
    country: p.country,
    city: p.city,
    street: p.street,
    postCode: p.postCode ?? '',
    mol: p.mol ?? '',
    linkedCompanyId: p.linkedCompanyId ?? null,
  };
}

function formToInput(f: PartnerForm): CreatePartnerInput {
  return {
    name: f.name,
    eik: f.eik,
    vatNumber: f.vatNumber || undefined,
    isIndividual: f.isIndividual,
    country: f.country || 'BG',
    city: f.city,
    street: f.street,
    postCode: f.postCode || undefined,
    mol: f.mol || undefined,
    linkedCompanyId: f.linkedCompanyId,
  };
}

export default function PartnersPage() {
  const { company } = useCompany();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [items, setItems] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [eikLooking, setEikLooking] = useState(false);
  const [linkedCompany, setLinkedCompany] = useState<Company | null>(null);
  const [selfEikError, setSelfEikError] = useState(false);
  const eikLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPartners({
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

  const doEikLookup = useCallback(
    async (eik: string) => {
      const trimmed = eik.trim();
      if (trimmed.length < 9) {
        setLinkedCompany(null);
        setSelfEikError(false);
        setForm((f) => ({ ...f, linkedCompanyId: null }));
        return;
      }

      if (trimmed === company.eik) {
        setSelfEikError(true);
        setLinkedCompany(null);
        setForm((f) => ({ ...f, linkedCompanyId: null }));
        return;
      }
      setSelfEikError(false);

      setEikLooking(true);
      const res = await lookupCompanyByEik(trimmed);
      setEikLooking(false);

      if (res.data) {
        setLinkedCompany(res.data);
        setForm((f) => ({
          ...f,
          linkedCompanyId: res.data!.id,
          name: res.data!.legalName,
          vatNumber: res.data!.vatNumber ?? '',
          country: res.data!.country ?? 'BG',
          city: res.data!.city ?? '',
          street: res.data!.street ?? '',
          postCode: res.data!.postCode ?? '',
          mol: res.data!.mol ?? '',
        }));
      } else {
        setLinkedCompany(null);
        setForm((f) => ({ ...f, linkedCompanyId: null }));
      }
    },
    [company.eik]
  );

  const handleEikChange = (value: string) => {
    setForm((f) => ({ ...f, eik: value }));
    if (eikLookupTimer.current) clearTimeout(eikLookupTimer.current);
    eikLookupTimer.current = setTimeout(() => doEikLookup(value), 500);
  };

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setForm(partnerToForm(p));
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setLinkedCompany(null);
    setSelfEikError(false);
  };

  const handleSave = async () => {
    if (selfEikError) return;
    setSaving(true);
    setError(null);
    const input = formToInput(form);

    if (editingId) {
      const res = await updatePartner(editingId, input);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        return;
      }
    } else {
      const res = await createPartner(input);
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
    if (!confirm('Delete this partner? This cannot be undone.')) return;
    setError(null);
    const res = await deletePartner(id);
    if (res.error) setError(res.error);
    else fetchData();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Partners</h1>
        <Button
          className="bg-orange-500 hover:bg-orange-600"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add partner
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
              {editingId ? 'Edit partner' : 'New partner'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedCompany && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Link2 className="inline h-4 w-4 mr-1 -mt-0.5" />
                This partner is a registered company in the system. Fields pre-filled from their profile.
              </div>
            )}
            {selfEikError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                You cannot add yourself as a partner.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pName">Name *</Label>
                <Input
                  id="pName"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Legal name"
                />
              </div>
              <div>
                <Label htmlFor="pEik">EIK *</Label>
                <div className="relative">
                  <Input
                    id="pEik"
                    value={form.eik}
                    onChange={(e) => handleEikChange(e.target.value)}
                    placeholder="9 or 10 digits"
                    className={selfEikError ? 'border-red-400' : ''}
                  />
                  {eikLooking && (
                    <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pCity">City *</Label>
                <Input
                  id="pCity"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="pStreet">Street *</Label>
                <Input
                  id="pStreet"
                  value={form.street}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, street: e.target.value }))
                  }
                  placeholder="Street address"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pPostCode">Post code</Label>
                <Input
                  id="pPostCode"
                  value={form.postCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postCode: e.target.value }))
                  }
                  placeholder="1000"
                />
              </div>
              <div>
                <Label htmlFor="pCountry">Country</Label>
                <Input
                  id="pCountry"
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                  placeholder="BG"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="pVat">VAT number</Label>
                <Input
                  id="pVat"
                  value={form.vatNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vatNumber: e.target.value }))
                  }
                  placeholder="BG123456789"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pMol">MOL</Label>
                <Input
                  id="pMol"
                  value={form.mol}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mol: e.target.value }))
                  }
                  placeholder="Representative"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer h-9">
                  <input
                    type="checkbox"
                    checked={form.isIndividual}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isIndividual: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Individual person (EGN)</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || selfEikError}>
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
              placeholder="Search by name or EIK..."
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
            Partner list{' '}
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
              No partners found. Add one with &quot;Add partner&quot;.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    EIK
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    VAT Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-200 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {p.name}
                      {p.isIndividual && (
                        <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          Individual
                        </span>
                      )}
                      {p.linkedCompanyId && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                          title="Linked to a registered company"
                        >
                          <Link2 className="h-3 w-3" />
                          Linked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.eik}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.vatNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.city}</td>
                    <td className="px-4 py-3 text-sm">{p.country}</td>
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
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(p.id)}
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
