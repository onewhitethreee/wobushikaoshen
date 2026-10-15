import * as migration_20261008_071929_initial from './20261008_071929_initial';
import * as migration_20261008_225528_units_and_question_fields from './20261008_225528_units_and_question_fields';
import * as migration_20261008_230428_writing_source_fields from './20261008_230428_writing_source_fields';
import * as migration_20261011_145854_ai_settings from './20261011_145854_ai_settings';
import * as migration_20261013_223045_unit_summary from './20261013_223045_unit_summary';
import * as migration_20261014_131240_009_account from './20261014_131240_009_account';

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
    name: '20261014_131240_009_account'
  },
];
