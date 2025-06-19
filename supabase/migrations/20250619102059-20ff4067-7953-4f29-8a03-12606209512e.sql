
-- Enable real-time updates for the leads table
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- Add the leads table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
