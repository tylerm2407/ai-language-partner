-- Add onboarding checklist JSONB column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb NOT NULL DEFAULT '{
  "chooseLanguage": false,
  "placementTest": false,
  "firstLesson": false,
  "aiConversation": false,
  "dailyReminder": false,
  "collapsed": false,
  "dismissed": false,
  "completedAt": null
}'::jsonb;
