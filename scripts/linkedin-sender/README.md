# iCapOS LinkedIn sender (pilot)

Runs on your own computer and fills in the LinkedIn invites iCapOS has approved. iCapOS decides
how many and when, the sender only does what it is told, one person at a time.

1. In iCapOS open LinkedIn, then Settings, then Sender, and create a key (shown once).
2. `cd scripts/linkedin-sender && npm install`
3. `ICAPOS_URL=https://your-domain ICAPOS_SENDER_KEY=lis_... npm start`
4. A Chrome window opens. Sign in to LinkedIn yourself. Your password never goes to iCapOS.

It starts in dry run: it fills the invite note and closes the box without sending.
Set `DRY_RUN=false` to send for real, only after a dry run looked right.

It stops by itself on any LinkedIn warning, and iCapOS pauses the account. Remove the key in
Settings to switch the sender off at any time.

The LinkedIn page selectors were written without access to the live site. Watch the first dry run.
