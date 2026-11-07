# Match coordination pipeline

## What will change
- Keep the existing match stages: **Proposed → Accepted (confirmed) → Completed**. A proposed match will show an editable hospital name; coordinators must enter a hospital before confirming it.
- Show the assigned hospital on confirmed matches. Only confirmed matches can be completed.
- Completing a match will record the selected hospital, donor, recipient, and organ in donation history, then update the donor and recipient statuses. Prevent duplicate history records if completion is retried.
- Keep existing compatible-pair suggestions and AI-assisted proposing intact.

## Technical details
- Add an optional hospital-name field to matches and use it as the source of truth for the completion history record.
- The app is connected to the user's separate Supabase project. Provide the additive SQL change for that database; do not apply it to Lovable Cloud, which is not the app's active database.
- Verify the full proposed → assign hospital → confirm → complete path, including a single history record and updated donor/recipient statuses.
