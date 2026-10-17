-- Support multi-day campus events while preserving existing single-day events.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date date;
UPDATE public.events SET end_date = event_date WHERE end_date IS NULL;
