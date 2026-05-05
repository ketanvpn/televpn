const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

const VARS_PATH = path.join(ROOT_DIR, '.vars.json');
const TRIAL_DB_PATH = path.join(ROOT_DIR, 'trial.db');
const TRIAL_CONFIG_PATH = path.join(ROOT_DIR, 'trial_config.json');

module.exports = {
  ROOT_DIR,
  VARS_PATH,
  TRIAL_DB_PATH,
  TRIAL_CONFIG_PATH,
};
