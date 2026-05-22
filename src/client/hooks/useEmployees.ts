import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employees } from '../api/http';
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../../../shared/types';

export function useEmployees(params?: { q?: string; department?: string }) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => Employees.list(params),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeDto) => Employees.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeDto }) => Employees.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Employees.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}
