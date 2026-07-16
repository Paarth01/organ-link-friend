
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'hospital', 'donor', 'recipient', 'user');
CREATE TYPE public.blood_type AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE public.organ_type AS ENUM ('kidney','liver','heart','lung','pancreas','cornea','bone_marrow','intestine');
CREATE TYPE public.donor_status AS ENUM ('available','matched','donated','withdrawn');
CREATE TYPE public.recipient_status AS ENUM ('waiting','matched','transplanted','cancelled');
CREATE TYPE public.urgency_level AS ENUM ('routine','urgent','critical');
CREATE TYPE public.match_status AS ENUM ('proposed','accepted','rejected','completed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  city text,
  blood_type public.blood_type,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: read own or any authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles: read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ DONORS ============
CREATE TABLE public.donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  age int NOT NULL CHECK (age > 0 AND age < 120),
  blood_type public.blood_type NOT NULL,
  organ public.organ_type NOT NULL,
  city text NOT NULL,
  hospital_name text,
  phone text,
  medical_notes text,
  status public.donor_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donors TO authenticated;
GRANT ALL ON public.donors TO service_role;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donors: read all authenticated" ON public.donors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Donors: insert own" ON public.donors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Donors: update own or admin" ON public.donors FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Donors: delete own or admin" ON public.donors FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ RECIPIENTS ============
CREATE TABLE public.recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  age int NOT NULL CHECK (age > 0 AND age < 120),
  blood_type public.blood_type NOT NULL,
  organ_needed public.organ_type NOT NULL,
  urgency public.urgency_level NOT NULL DEFAULT 'routine',
  city text NOT NULL,
  hospital_name text,
  phone text,
  medical_notes text,
  status public.recipient_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipients TO authenticated;
GRANT ALL ON public.recipients TO service_role;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients: read all authenticated" ON public.recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recipients: insert own" ON public.recipients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Recipients: update own or admin" ON public.recipients FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Recipients: delete own or admin" ON public.recipients FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  status public.match_status NOT NULL DEFAULT 'proposed',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (donor_id, recipient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches: read all authenticated" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Matches: insert authenticated" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Matches: update by creator or party" ON public.matches FOR UPDATE TO authenticated USING (
  auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM public.donors d WHERE d.id = donor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.recipients r WHERE r.id = recipient_id AND r.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
) WITH CHECK (true);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notif: read own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Notif: update own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notif: delete own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Notif: insert authenticated" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============ DONATION HISTORY ============
CREATE TABLE public.donation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  donor_name text NOT NULL,
  recipient_name text NOT NULL,
  organ public.organ_type NOT NULL,
  hospital_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_history TO authenticated;
GRANT ALL ON public.donation_history TO service_role;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "History: read all authenticated" ON public.donation_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "History: insert authenticated" ON public.donation_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============ TIMESTAMP TRIGGERS ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_donors_updated BEFORE UPDATE ON public.donors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_recipients_updated BEFORE UPDATE ON public.recipients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.donors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
