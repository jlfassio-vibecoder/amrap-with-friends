-- One-time ops script: create coach@amrapwithfriends.com and grant coach dashboard access.
-- Run: supabase db query --linked -f supabase/scripts/add_coach_user.sql

DO $$
DECLARE
  v_email text := 'coach@amrapwithfriends.com';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"coach"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.coach_users (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

SELECT u.id, u.email, cu.created_at AS coach_since
FROM auth.users u
JOIN public.coach_users cu ON cu.user_id = u.id
WHERE u.email = 'coach@amrapwithfriends.com';
