-- Sales Forecast — batch A seeds. Idempotent: creates the default Base scenario with
-- PLACEHOLDER drivers only if no Base scenario exists yet, and seeds pipeline weights
-- for any CRM stage that doesn't have one. Replace PLACEHOLDER values during calibration.

do $$
declare
  v_scenario uuid;
begin
  select id into v_scenario from public.sales_forecast_scenarios where kind = 'base' limit 1;

  if v_scenario is null then
    insert into public.sales_forecast_scenarios (name, kind, is_active, notes)
    values ('Base', 'base', true, 'PLACEHOLDER — calibrate drivers before the first official snapshot')
    returning id into v_scenario;

    -- Global (segment = null) PLACEHOLDER drivers. Rates are 0..1; arpu_monthly is CENTS.
    insert into public.sales_forecast_assumptions (scenario_id, driver_key, segment, month_from, month_to, value) values
      (v_scenario, 'leads_per_month',             null, 0, 0, 100),
      (v_scenario, 'lead_growth_rate_mom',        null, 0, 0, 0.05),
      (v_scenario, 'lead_to_mql',                 null, 0, 0, 0.40),
      (v_scenario, 'mql_to_sql',                  null, 0, 0, 0.50),
      (v_scenario, 'sql_to_trial',                null, 0, 0, 0.60),
      (v_scenario, 'trial_to_paid',               null, 0, 0, 0.30),
      (v_scenario, 'avg_sales_cycle_days',        null, 0, 0, 30),
      (v_scenario, 'arpu_monthly',                null, 0, 0, 49900),
      (v_scenario, 'annual_prepay_mix',           null, 0, 0, 0.30),
      (v_scenario, 'price_change_pct',            null, 0, 0, 0),
      (v_scenario, 'logo_churn_monthly',          null, 0, 0, 0.03),
      (v_scenario, 'expansion_mrr_pct_monthly',   null, 0, 0, 0.01),
      (v_scenario, 'contraction_mrr_pct_monthly', null, 0, 0, 0.005);
  end if;

  -- Pipeline weights for any active stage lacking one. Placeholder probabilities scale
  -- with sort_order; won stages = 1.0.
  insert into public.sales_forecast_pipeline_weights (stage_id, win_probability, expected_lag_days)
  select s.id,
         case when s.is_won then 1.0
              else least(0.90, greatest(0.05, round(((s.sort_order + 1) * 0.18)::numeric, 2))) end,
         30
  from public.sales_stages s
  where not exists (
    select 1 from public.sales_forecast_pipeline_weights w where w.stage_id = s.id
  );
end $$;
