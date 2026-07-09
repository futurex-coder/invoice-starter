'use client';

import { useState, useCallback, useRef } from 'react';
import { useListPageState } from '@/lib/swr/use-list-page-state';
import { Button } from '@/components/ui/button';
import {
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  lookupCompanyByEik,
  type ListResult,
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PartnerFormCard,
  emptyPartnerForm,
  type PartnerForm,
} from './PartnerForm';
import { PartnersTable } from './PartnersTable';
import { PageShell } from '@/components/page-shell';

function partnerToForm(p: Partner): PartnerForm {
  return {
    name: p.name,
    eik: p.eik ?? '',
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

export function PartnersPageClient({
  fallbackData,
}: {
  fallbackData?: ListResult<Partner>;
}) {
  const { company } = useCompany();

  const list = useListPageState({
    swrKey: 'partners',
    defaults: { search: '' },
    fallbackData,
    action: ({ search, page, pageSize }) =>
      listPartners({ search: search || undefined, page, pageSize }),
  });

  const items = list.result?.items ?? [];
  const total = list.result?.total ?? 0;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyPartnerForm);
  const [saving, setSaving] = useState(false);

  const [eikLooking, setEikLooking] = useState(false);
  const [linkedCompany, setLinkedCompany] = useState<Company | null>(null);
  const [selfEikError, setSelfEikError] = useState(false);
  const eikLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPartnerForm);
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    list.setActionError(null);
    list.setActionValidationErrors(null);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setForm(partnerToForm(p));
    setLinkedCompany(null);
    setSelfEikError(false);
    setShowForm(true);
    list.setActionError(null);
    list.setActionValidationErrors(null);
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
    try {
      const input = formToInput(form);
      if (editingId) {
        await list.runMutation(() => updatePartner(editingId, input));
      } else {
        await list.runMutation(() => createPartner(input));
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
    await list.runMutation(() => deletePartner(confirmDelete.id));
  };

  return (
    <PageShell>
      <ListPageHeader
        title="Контрагенти"
        action={
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Добави контрагент
          </Button>
        }
      />

      <ErrorAlert message={list.error} className="mb-4" />

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
          validationErrors={list.actionValidationErrors}
        />
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <SearchBar
            value={list.searchInput}
            onChange={list.setSearchInput}
            onSubmit={list.commitSearch}
            placeholder="Търсене по име или ЕИК..."
          />
        </CardContent>
      </Card>

      <ListCard
        title="Списък с контрагенти"
        count={total}
        loading={list.loading}
        isEmpty={!items.length}
        emptyMessage='Няма намерени контрагенти. Добавете с „Добави контрагент“.'
        page={list.page}
        pageSize={list.pageSize}
        total={total}
        onPageChange={list.setPage}
      >
        <PartnersTable
          partners={items}
          onEdit={openEdit}
          onDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
        />
      </ListCard>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Изтриване на контрагент?"
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
