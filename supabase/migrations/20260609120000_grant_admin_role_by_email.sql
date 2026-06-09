-- Ensure the site owner keeps admin role after OAuth (user id may differ from seed).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'andreswebit@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
