-- Gated introductions: Professional moves from 50 to 20 requests a month and
-- gains a 5 a week cap. Basic stays at 5 a month with no weekly cap.
-- Run together with the deploy that reads weeklyByPlan.
update platform_settings
set value = jsonb_build_object(
      'monthlyByPlan', jsonb_build_object('basic', 5, 'professional', 20),
      'weeklyByPlan',  jsonb_build_object('basic', null, 'professional', 5)
    ),
    updated_at = now()
where key = 'founder_connection_config';
