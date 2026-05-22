import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AI } from '../api/http';

export function useAiJob(jobId: string | null) {
  return useQuery({
    queryKey: ['ai-job', jobId],
    queryFn:  () => AI.getJob(jobId!),
    enabled:  !!jobId,
    // Поллер на сервере + WebSocket-апдейты уже доставляют свежие данные.
    // Клиентский poll держим как страховку, но реже — раз в 8 секунд.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'success' || status === 'failed') return false;
      return 8000;
    },
    // Кэш живёт 30 минут, чтобы переключение вкладок не теряло результат
    gcTime:    30 * 60 * 1000,
    staleTime: 5_000,
  });
}

export function useAiJobs() {
  return useQuery({
    queryKey: ['ai-jobs'],
    queryFn:  () => AI.listJobs(),
    staleTime: 30_000,
  });
}

export function useGenerateImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AI.generateImage,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-jobs'] }),
  });
}

export function useGenerateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AI.generateVideo,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-jobs'] }),
  });
}

export function useGenerateMusic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AI.generateMusic,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-jobs'] }),
  });
}

export function useAiChat() {
  return useMutation({ mutationFn: AI.chat });
}
