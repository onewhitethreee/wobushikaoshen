import * as migration_20261008_071929_initial from './20261008_071929_initial';
import * as migration_20261008_225528_units_and_question_fields from './20261008_225528_units_and_question_fields';
import * as migration_20261008_230428_writing_source_fields from './20261008_230428_writing_source_fields';
import * as migration_20261011_145854_ai_settings from './20261011_145854_ai_settings';
import * as migration_20261013_223045_unit_summary from './20261013_223045_unit_summary';
import * as migration_20261014_131240_009_account from './20261014_131240_009_account';
import * as migration_20261016_003353_011_credits from './20261016_003353_011_credits';
import * as migration_20261016_110413_012_password from './20261016_110413_012_password';
import * as migration_20261016_121936_013_dict from './20261016_121936_013_dict';

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
    name: '20261016_121936_013_dict'
  },
];
