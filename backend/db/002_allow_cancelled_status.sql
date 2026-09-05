-- =============================================================================
-- QueueIQ — migration: allow the 'Cancelled' token status
-- =============================================================================
-- The cancel-booking flow (booking.controller.cancelBooking) sets a token's
-- status to 'Cancelled', but the tokens_status_check constraint did NOT permit
-- that value — so every cancellation failed with:
--   new row for relation "tokens" violates check constraint "tokens_status_check"
-- (HTTP 500). This widens the constraint to include 'Cancelled', keeping every
-- previously-allowed value.
--
-- Safe/idempotent. Apply in Supabase → SQL Editor (or via your migration tool).
-- =============================================================================

alter table public.tokens drop constraint if exists tokens_status_check;

alter table public.tokens add constraint tokens_status_check
  check (status in ('Waiting','Serving','Done','Skipped','PendingApproval','Rejected','Cancelled'));
