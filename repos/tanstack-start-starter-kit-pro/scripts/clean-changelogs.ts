import { exec } from 'node:child_process'

exec('rm CHANGELOG.md')
exec('rm -rf apps/**/CHANGELOG.md')
exec('rm -rf packages/**/CHANGELOG.md')
