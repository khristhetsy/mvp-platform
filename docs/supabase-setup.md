# Supabase Setup

1. Create a Supabase project and copy the project URL, anon key, and service role key into `.env.local`.
2. Run the SQL in `supabase/migrations/0001_initial_schema_rls.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Confirm the private storage bucket `company-documents` exists and has `Public bucket` disabled.
4. Store files using this object path format:

```text
{company_id}/{document_type}/{filename}
```

The bucket name is `company-documents`, so the full storage location is:

```text
company-documents/{company_id}/{document_type}/{filename}
```

5. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. Use it only in secure server-side API routes when admin-level writes or signed URL generation are required.

## Access Model

- Founders can view and update only their own companies.
- Founders can upload and view documents only for companies they own.
- Admins can view and update all records.
- Analysts can view companies, documents, and diligence reports.
- Investors can view only published campaigns and approved documents for those campaigns.
- Investors can create only their own interest records.
- Users can view and update only their own profile.

## Auth Redirects

After signup, Supabase creates `profiles` rows through the `handle_new_user` trigger. The app middleware then routes users by role:

- `founder` -> `/founder/dashboard`
- `investor` -> `/investor/dashboard`
- `admin` -> `/admin/dashboard`
- `analyst` -> `/admin/dashboard`
