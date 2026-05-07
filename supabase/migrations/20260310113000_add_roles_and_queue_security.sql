ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE public.books
  ADD CONSTRAINT books_status_check
  CHECK (status IN ('uploaded', 'queued', 'processing', 'completed', 'failed'));

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_by_admin UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx ON public.app_users (LOWER(email));

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read books" ON public.books;
DROP POLICY IF EXISTS "Anyone can insert books" ON public.books;
DROP POLICY IF EXISTS "Anyone can update books" ON public.books;
DROP POLICY IF EXISTS "Anyone can delete books" ON public.books;

DROP POLICY IF EXISTS "Anyone can read chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can insert chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can delete chapters" ON public.chapters;

DROP POLICY IF EXISTS "Anyone can upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload audiobooks" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update audiobooks" ON storage.objects;

CREATE POLICY "Public can read audiobooks" ON storage.objects
FOR SELECT USING (bucket_id = 'audiobooks');
