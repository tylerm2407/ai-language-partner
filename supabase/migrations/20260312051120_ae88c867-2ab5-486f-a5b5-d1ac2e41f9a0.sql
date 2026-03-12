
INSERT INTO public.profiles (id, full_name)
SELECT id, raw_user_meta_data ->> 'full_name'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
