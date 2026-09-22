// Mesmo projeto Supabase do controla-crm (prospects/metas já existentes).
// A anon key é pública por design — a segurança fica nas policies do banco.
const SUPABASE_URL = 'https://bzpakjbvfojosajdvwpv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cGFramJ2Zm9qb3NhamR2d3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDg0MjIsImV4cCI6MjA5MTMyNDQyMn0.xm94VIy78m7pv1H3um0eIDWcXoIZUwdxZbpVB3qFHHg';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
