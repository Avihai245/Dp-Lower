-- Case references keep their four digits and never repeat, however many leads there are.
begin;

do $$
begin
  assert public.format_case_ref(1001, '2026-10-09 12:00+03') = 'DPL-26-1001', 'four digits';
  assert public.format_case_ref(7, '2026-10-09 12:00+03') = 'DPL-26-0007', 'padded';
  assert public.format_case_ref(9999, '2026-10-09 12:00+03') = 'DPL-26-9999', 'last four-digit number';
  assert public.format_case_ref(10000, '2026-10-09 12:00+03') = 'DPL-26-10000', 'five digits are not cut';
  assert public.format_case_ref(10001, '2026-10-09 12:00+03') = 'DPL-26-10001', 'and are distinct';
  assert public.format_case_ref(123456, '2027-01-01 00:30+02') = 'DPL-27-123456', 'six digits, next year';
  assert public.next_case_ref() ~ '^DPL-\d{2}-\d{4,}$', 'the real generator has the same shape';
end $$;

rollback;
