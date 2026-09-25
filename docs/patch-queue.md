# Patch queue

Approved changes reach `main` without personal GitHub tokens:

1. Claude builds and tests a change, and Khris approves it.
2. Claude adds the change (`git format-patch` output) to the private
   `dev_patch_queue` table in Supabase.
3. The **Apply patch queue** GitHub Action (every 5 minutes, or run it by hand
   from the Actions tab) applies pending patches with `git am`, pushes to
   `main`, and records the result on the queue row.
4. Vercel deploys `main` as usual.

A patch that does not apply cleanly is marked `failed` with the reason, and
nothing is pushed. The Action reads the queue with the `DEV_PATCH_KEY`
repository secret; rotate it by changing the secret and the hash in
`public.dev_patch_key_ok`.
