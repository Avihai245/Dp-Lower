-- A queued email that should no longer go out (the person unsubscribed or submitted in the meantime, the address was
-- corrected, the event went stale during an outage) is cancelled, not "dead": dead means "delivery kept failing" and is
-- re-queued by hand after a webhook fix, which must never resend a cancelled email.
alter type public.event_status add value if not exists 'cancelled';
