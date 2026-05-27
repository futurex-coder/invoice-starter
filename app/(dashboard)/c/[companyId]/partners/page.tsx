'use client';

import { useState, useCallback, useRef } from 'react';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { Button } from '@/components/ui/button';
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
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { SearchBar } from '@/components/list-page/SearchBar';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import {
  PartnerFormCard,
  emptyPartnerForm,
  type PartnerForm,
} from './_components/PartnerForm';
import { PartnersTable } from './_components/PartnersTable';
import { PageShell } from '@/components/page-shell';

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

  const {
    data: result,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(
    ['partners', search, page],
    () => listPartners({ search: search || undefined, page, pageSize })
  );

  const items = result?.items ?? [];
  const total = result?.total ?? 0;

  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (fetchError ? fetchError.message : null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyPartnerForm);
  const [saving, setSaving] = useState(false);

  const [eikLooking, setEikLooking] = useState(false);
  const [linkedCompany, setLinkedCompany] = useState<Company | null>(null);
  const [selfEikError, setSelfEikError] = useState(false);
  const eikLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const linked = res.data;
        setLinkedCompany(linked);
        setForm((f) => ({
          ...f,
          linkedCompanyId: linked.id,
          name: linked.legalName,
          vatNumber: linked.vatNumber ?? '',
          country: linked.country ?? 'BG',
          city: linked.city ?? '',
          street: linked.street ?? '',
          postCode: linked.postCode ?? '',
          mol: linked.mol ?? '',
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

  const handleFormChange = (patch: Partial<PartnerForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPartnerForm);
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    setActionError(null);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setForm(partnerToForm(p));
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    setActionError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyPartnerForm);
    setLinkedCompany(null);
    setSelfEikError(false);
  };

  const handleSave = async () => {
    if (selfEikError) return;
    setSaving(true);
    setActionError(null);
    const input = formToInput(form);

    if (editingId) {
      const res = await updatePartner(editingId, input);
      setSaving(false);
      if (res.error) {
        setActionError(res.error);
        return;
      }
    } else {
      const res = await createPartner(input);
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
    if (!confirm('Delete this partner? This cannot be undone.')) return;
    setActionError(null);
    const res = await deletePartner(id);
    if (res.error) setActionError(res.error);
    else refetch();
  };

  return (
    <PageShell>
      <ListPageHeader
        title="Partners"
        action={
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add partner
          </Button>
        }
      />

      <ErrorAlert message={error} className="mb-4" />

      {showForm && (
        <PartnerFormCard
          isEditing={editingId != null}
          form={form}
          onFormChange={handleFormChange}
          onEikChange={handleEikChange}
          eikLooking={eikLooking}
          linkedCompany={linkedCompany}
          selfEikError={selfEikError}
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
            placeholder="Search by name or EIK..."
          />
        </CardContent>
      </Card>

      <ListCard
        title="Partner list"
        count={total}
        loading={loading}
        isEmpty={!items.length}
        emptyMessage='No partners found. Add one with "Add partner".'
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      >
        <PartnersTable
          partners={items}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </ListCard>
    </PageShell>
  );
}
