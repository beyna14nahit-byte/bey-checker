-- Owner-confirmed business details for sites already seeded with the earlier defaults.
-- Only fills values that were never set in the admin dashboard, so it cannot overwrite them.
update settings
set data = jsonb_set(data, '{promotion}', '{"enabled": true, "labelEn": "End of October Sale", "labelMs": "Jualan Akhir Oktober", "startsAt": "2026-10-01T00:00:00+08:00", "endsAt": "2026-11-01T00:00:00+08:00"}'::jsonb)
where coalesce(data->'promotion'->>'startsAt', '') = '';

update settings
set data = jsonb_set(data, '{contact,whatsapp}', '"60109882148"'::jsonb)
where coalesce(data->'contact'->>'whatsapp', '') = '';
