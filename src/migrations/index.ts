import * as migration_20261008_071929_initial from './20261008_071929_initial';
import * as migration_20261008_225528_units_and_question_fields from './20261008_225528_units_and_question_fields';
import * as migration_20261008_230428_writing_source_fields from './20261008_230428_writing_source_fields';
import * as migration_20261011_145854_ai_settings from './20261011_145854_ai_settings';
import * as migration_20261013_223045_unit_summary from './20261013_223045_unit_summary';
import * as migration_20261014_131240_009_account from './20261014_131240_009_account';
import * as migration_20261016_003353_011_credits from './20261016_003353_011_credits';
import * as migration_20261016_110413_012_password from './20261016_110413_012_password';
import * as migration_20261016_121936_013_dict from './20261016_121936_013_dict';
import * as migration_20261017_115619_015_review from './20261017_115619_015_review';
import * as migration_20261017_203040_016_signup_redeem from './20261017_203040_016_signup_redeem';
import * as migration_20261019_183201_026_paraphrase from './20261019_183201_026_paraphrase';
import * as migration_20261019_184315_027_jijing from './20261019_184315_027_jijing';
import * as migration_20261020_123703_028_mock from './20261020_123703_028_mock';
import * as migration_20261023_132325_footer_contact from './20261023_132325_footer_contact';
import * as migration_20261023_140545_029_content_api from './20261023_140545_029_content_api';
import * as migration_20261024_133706_032_note_platform from './20261024_133706_032_note_platform';
import * as migration_20261024_141309_031_answer_report from './20261024_141309_031_answer_report';

export const migrations = [
  {
    up: migration_20261008_071929_initial.up,
    down: migration_20261008_071929_initial.down,
    name: '20261008_071929_initial',
  },
  {
    up: migration_20261008_225528_units_and_question_fields.up,
    down: migration_20261008_225528_units_and_question_fields.down,
    name: '20261008_225528_units_and_question_fields',
  },
  {
    up: migration_20261008_230428_writing_source_fields.up,
    down: migration_20261008_230428_writing_source_fields.down,
    name: '20261008_230428_writing_source_fields',
  },
  {
    up: migration_20261011_145854_ai_settings.up,
    down: migration_20261011_145854_ai_settings.down,
    name: '20261011_145854_ai_settings',
  },
  {
    up: migration_20261013_223045_unit_summary.up,
    down: migration_20261013_223045_unit_summary.down,
    name: '20261013_223045_unit_summary',
  },
  {
    up: migration_20261014_131240_009_account.up,
    down: migration_20261014_131240_009_account.down,
    name: '20261014_131240_009_account',
  },
  {
    up: migration_20261016_003353_011_credits.up,
    down: migration_20261016_003353_011_credits.down,
    name: '20261016_003353_011_credits',
  },
  {
    up: migration_20261016_110413_012_password.up,
    down: migration_20261016_110413_012_password.down,
    name: '20261016_110413_012_password',
  },
  {
    up: migration_20261016_121936_013_dict.up,
    down: migration_20261016_121936_013_dict.down,
    name: '20261016_121936_013_dict',
  },
  {
    up: migration_20261017_115619_015_review.up,
    down: migration_20261017_115619_015_review.down,
    name: '20261017_115619_015_review',
  },
  {
    up: migration_20261017_203040_016_signup_redeem.up,
    down: migration_20261017_203040_016_signup_redeem.down,
    name: '20261017_203040_016_signup_redeem',
  },
  {
    up: migration_20261019_183201_026_paraphrase.up,
    down: migration_20261019_183201_026_paraphrase.down,
    name: '20261019_183201_026_paraphrase',
  },
  {
    up: migration_20261019_184315_027_jijing.up,
    down: migration_20261019_184315_027_jijing.down,
    name: '20261019_184315_027_jijing',
  },
  {
    up: migration_20261020_123703_028_mock.up,
    down: migration_20261020_123703_028_mock.down,
    name: '20261020_123703_028_mock',
  },
  {
    up: migration_20261023_132325_footer_contact.up,
    down: migration_20261023_132325_footer_contact.down,
    name: '20261023_132325_footer_contact',
  },
  {
    up: migration_20261023_140545_029_content_api.up,
    down: migration_20261023_140545_029_content_api.down,
    name: '20261023_140545_029_content_api',
  },
  {
    up: migration_20261024_133706_032_note_platform.up,
    down: migration_20261024_133706_032_note_platform.down,
    name: '20261024_133706_032_note_platform',
  },
  {
    up: migration_20261024_141309_031_answer_report.up,
    down: migration_20261024_141309_031_answer_report.down,
    name: '20261024_141309_031_answer_report'
  },
];
