'use client';

import { useCallback, useReducer } from 'react';
import type { Partner } from '@/lib/db/schema';
import type { BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import type { LineItemForm, RecipientForm } from './types';
import { formReducer, type FormState } from './form-state';

export function useInvoiceForm(initial: FormState) {
  const [state, dispatch] = useReducer(formReducer, initial);

  const update = useCallback((patch: Partial<FormState>) => {
    dispatch({ type: 'SET', patch });
  }, []);

  const updateRecipient = useCallback((patch: Partial<RecipientForm>) => {
    dispatch({ type: 'SET_RECIPIENT', patch });
  }, []);

  const selectPartner = useCallback((partner: Partner | null) => {
    dispatch({ type: 'SELECT_PARTNER', partner });
  }, []);

  const addLine = useCallback((vatRate: BgVatRate) => {
    dispatch({ type: 'ADD_LINE', vatRate });
  }, []);

  const updateLine = useCallback((index: number, patch: Partial<LineItemForm>) => {
    dispatch({ type: 'UPDATE_LINE', index, patch });
  }, []);

  const removeLine = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_LINE', index });
  }, []);

  const hydrate = useCallback((next: FormState) => {
    dispatch({ type: 'HYDRATE', state: next });
  }, []);

  return {
    state,
    update,
    updateRecipient,
    selectPartner,
    addLine,
    updateLine,
    removeLine,
    hydrate,
  };
}
