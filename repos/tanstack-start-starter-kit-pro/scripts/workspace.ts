import { execSync } from 'node:child_process'
import type { PackageJson } from 'pkg-types'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  getPackageManager,
  replaceInFile,
  traverseDirectory,
  updateNamespaceInPrettierConfig,
  updateWorkspacePackages,
} from './utils'

const DEFAULT_NAMESPACE = '@workspace'

const argv = yargs(hideBin(process.argv))
  .option('namespace', {
    alias: 'n',
    type: 'string',
    demandOption: true,
    description: 'The new namespace for the packages, eg `@my-company`.',
  })
  .option('current-namespace', {
    alias: 'c',
    type: 'string',
    demandOption: false,
    description:
      'The current namespace for the packages. Defaults to `@workspace`.',
  })
  .parseSync()

if (!argv.namespace) {
  console.error('❗ Please provide a namespace, eg `@my-company`.')
  process.exit(1)
}

const currentNamespace = argv['current-namespace'] ?? DEFAULT_NAMESPACE

const newNamespace = argv.namespace.match(/^@/)
  ? argv.namespace
  : `@${argv.namespace}`

// Record to store updated package names
const updatedPackages: Record<string, string> = {}

const ignoredFolders = [
  'node_modules',
  '.output',
  '.turbo',
  'dist',
  'build',
  '.git',
  '.yarn',
]

const ignoredFiles = ['yarn.lock', 'pnpm-lock.yaml', 'scripts/workspace.ts']

/**
 * Function to update the name in package.json files
 * @param packageJson the parsed package.json
 * @param fullPath the full path to the package.json file
 * @returns updated package.json
 */
function updatePackageName(
  packageJson: PackageJson,
  fullPath: string,
): PackageJson {
  if (!newNamespace) {
    return packageJson
  }

  if (packageJson.name?.match(new RegExp(`^${currentNamespace}`))) {
    // Update the name
    const parts = packageJson.name.split('/')

    if (parts.length === 2) {
      // Update the name
      parts[0] = newNamespace
      const newPackageName = parts.join('/')
      updatedPackages[packageJson.name] = newPackageName

      console.log(`Updated name in ${fullPath} to ${newPackageName}`)

      return {
        ...packageJson,
        name: newPackageName,
      }
    } else if (fullPath === process.cwd()) {
      console.log(`Updated name in ${fullPath} to ${packageJson.name}`)

      return {
        ...packageJson,
        name: newNamespace.replace('@', ''),
      }
    }
  }
  return packageJson
}

/**
 * Function to update the package.json details
 * @param packageJson the parsed package.json
 * @param fullPath the full path to the package.json file
 * @returns updated package.json
 */
function updatePackageJsonDetails(
  packageJson: PackageJson,
  fullPath: string,
): PackageJson {
  packageJson = updatePackageName(packageJson, fullPath)

  return packageJson
}

/**
 * Update the dependencies in all package.json files
 * @param packageJson the parsed package.json
 * @returns updated package.json
 */
function updateDependencies(packageJson: PackageJson): PackageJson {
  if (packageJson.dependencies) {
    return {
      ...packageJson,
      dependencies: renameDependencies(packageJson.dependencies),
    }
  }

  if (packageJson.devDependencies) {
    return {
      ...packageJson,
      devDependencies: renameDependencies(packageJson.devDependencies),
    }
  }

  return packageJson
}

/**
 * Function to rename dependencies in a package.json
 * @param dependencies the dependencies to update
 * @returns updated dependencies
 */
function renameDependencies(
  dependencies: Record<string, string> | undefined,
): Record<string, string> {
  if (!dependencies) {
    return {}
  }

  for (const [name, version] of Object.entries(dependencies)) {
    const dependency = updatedPackages[name]
    if (dependency && dependency !== name) {
      dependencies[dependency] = version
      delete dependencies[name]
      console.log(`Updated dependency from ${name} to ${dependency}`)
    }
  }

  return dependencies
}

/**
 * Function to find and replace package names in all files
 */
async function findAndReplacePackageNames() {
  if (!newNamespace) {
    return
  }

  console.log('🗂️ Finding and replacing package names in all files...')

  await traverseDirectory(
    process.cwd(),
    async (fullPath) => {
      await replaceInFile(fullPath, updatedPackages, ignoredFiles)
    },
    ignoredFolders,
  )

  await updateNamespaceInPrettierConfig(
    process.cwd(),
    currentNamespace,
    newNamespace,
  )
}

await updateWorkspacePackages(process.cwd(), updatePackageJsonDetails)

if (newNamespace) {
  const pm = await getPackageManager()

  // Update dependencies
  console.log('🔄 Updating dependencies...')

  await updateWorkspacePackages(process.cwd(), updateDependencies)

  // Find and replace package names in all files
  await findAndReplacePackageNames()

  // Done
  console.log(`🔄 Running ${pm} install...`)

  await execSync(`${pm} install`)

  console.log(
    `🎉 Done! The workspace namespace has been updated to ${newNamespace}.`,
  )
  console.log('You may wish to reload your IDE, to remove any errors.')
}
