import { PlopTypes } from '@turbo/gen'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.addHelper('eq', (value, compare, options) => {
    if (value === compare) {
      return options.fn(this)
    } else {
      return options.inverse(this)
    }
  })

  plop.addHelper('secret', () => createAuthSecret())

  plop.setGenerator('env', {
    description: 'Create your .env file',
    prompts: [
      {
        type: 'input',
        name: 'email_from',
        message: 'Email address used to send emails from the application?',
        default: 'hello@saas-ui.dev',
      },
    ],

    actions: [
      {
        type: 'add',
        path: '{{ turbo.paths.root }}/.env',
        templateFile: 'templates/env.hbs',
      },
      createEnvSymlink,
    ],
  })
}

function createAuthSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  // @ts-expect-error
  return Buffer.from(bytes, 'base64').toString('base64')
}

async function createEnvSymlink() {
  try {
    const root = path.join(__dirname, '..', '..')

    fs.symlinkSync(
      path.join(root, '.env'),
      path.join(root, 'apps', 'web', '.env'),
      'file',
    )
  } catch (error) {
    console.error('Error creating .env symlink:', error)
  }

  return 'apps/web/.env symlink created'
}
