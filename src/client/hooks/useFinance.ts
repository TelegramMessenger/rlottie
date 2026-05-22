import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Finance } from '../api/http';
import type { CreateFinanceRecordDto } from '../../../shared/types';

export function useFinance(params?: { project_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['finance', params],
    queryFn: () => Finance.list(params),
  });
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => Finance.summary(),
  });
}

export function useCreateFinanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFinanceRecordDto) => Finance.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

export function useUpdateFinanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceRecordDto> }) => Finance.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useDeleteFinanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Finance.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}
