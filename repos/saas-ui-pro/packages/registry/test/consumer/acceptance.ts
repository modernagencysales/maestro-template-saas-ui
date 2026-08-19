import { spawn } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'

import {
  REPOSITORY_ROOT,
  assertProConsumerFixture,
  findConsumerDependency,
  installProConsumerFixture,
  reinstallProConsumerFixture,
  removeConsumerDirectory,
} from './fixture'

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'production',
      },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else {
        reject(
          new Error(
            `${path.basename(command)} ${args.join(' ')} failed with ${
              signal ? `signal ${signal}` : `exit code ${code}`
            }.`,
          ),
        )
      }
    })
  })
}

async function workspaceBinary(name: string) {
  const target = path.join(REPOSITORY_ROOT, 'node_modules/.bin', name)
  if (!existsSync(target)) {
    throw new Error(`Missing workspace binary ${target}. Restore dependencies.`)
  }
  return target
}

async function linkInstalledDependencies(cwd: string) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(cwd, 'package.json'), 'utf8'),
  ) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  const names = [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ].sort()
  for (const name of names) {
    const target = path.join(cwd, 'node_modules', name)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.symlink(await findConsumerDependency(name), target, 'junction')
  }
}

async function main() {
  const acceptanceRoot = path.join(REPOSITORY_ROOT, '.next')
  await fs.mkdir(acceptanceRoot, { recursive: true })
  const cwd = await fs.mkdtemp(
    path.join(acceptanceRoot, 'pro-registry-consumer-'),
  )
  try {
    const fixture = await installProConsumerFixture(cwd)
    await assertProConsumerFixture(fixture)
    await reinstallProConsumerFixture(fixture)
    await linkInstalledDependencies(cwd)
    process.stdout.write(
      `Installed ${fixture.selectedItems.length} Pro roots and ` +
        `${fixture.install.plan.items.length - fixture.selectedItems.length} ` +
        'public dependencies.\n',
    )
    const [tsc, next] = await Promise.all([
      workspaceBinary('tsc'),
      workspaceBinary('next'),
    ])
    await run(tsc, ['--project', 'tsconfig.json', '--pretty', 'false'], cwd)
    await run(next, ['build'], cwd)
  } finally {
    await removeConsumerDirectory(cwd)
    await fs.rmdir(acceptanceRoot).catch(() => undefined)
  }
}

await main()
