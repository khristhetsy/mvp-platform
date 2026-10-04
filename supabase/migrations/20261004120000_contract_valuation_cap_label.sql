-- Due Diligence Services Agreement: the valuation field reads "Valuation cap",
-- matching the term sheet it follows in the same send. Label only; the token
-- (equity_valuation) and the master's legal wording are unchanged.
update public.contract_template_fields
   set label = 'Valuation cap'
 where token = 'equity_valuation'
   and label = 'Equity valuation (pre money)';
