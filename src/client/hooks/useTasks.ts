import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tasks } from '../api/http';
import type { CreateTaskDto, UpdateTaskDto } from '../../../shared/types';

export function useTasks(params?: { project_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => Tasks.list(params),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskDto) => Tasks.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskDto }) => Tasks.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Tasks.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
