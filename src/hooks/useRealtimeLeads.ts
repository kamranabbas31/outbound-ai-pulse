
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeLeads = (campaignId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead updated in real-time:', payload);
          
          // Invalidate and refetch leads queries
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          
          // If we have a specific campaign, also invalidate campaign-specific queries
          if (campaignId) {
            queryClient.invalidateQueries({ queryKey: ['campaign-leads', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, campaignId]);
};
