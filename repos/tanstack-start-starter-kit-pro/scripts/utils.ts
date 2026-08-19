import * as fs from 'fs'
import * as fsPromise from 'fs/promises'
import * as path from 'path'
import type { PackageJson } from 'pkg-types'

/**
 * Function to read and parse the root package.json
 * @param cwd the current working directory
 * @returns the root package.json in the workspace.
 */
export function getRootPackageJson(cwd: string): PackageJson {
  const rootPackageJsonPath = path.resolve(cwd, 'package.json')
  const rootPackageJson = JSON.parse(
    fs.readFileSync(rootPackageJsonPath, 'utf-8'),
  ) as PackageJson
  return rootPackageJson
}

/**
 * Function to get all workspace package paths.
 * @param workspaces the workspaces defined in the root package.json.
 * @returns an array of all workspace package paths.
 */
export function getWorkspacePackagePaths(workspaces: string[]): string[] {
  const workspacePackagePaths: string[] = []

  workspaces.forEach((workspacePattern) => {
    const workspaceDirs = workspacePattern.replace(/\/\*$/, '')
    const absolutePath = path.resolve(process.cwd(), workspaceDirs)
    const packages = fs
      .readdirSync(absolutePath)
      .map((pkgDir) => path.join(workspaceDirs, pkgDir))
      .filter((pkgPath) => fs.existsSync(path.join(pkgPath, 'package.json'))) // Filter only directories with package.json
    workspacePackagePaths.push(...packages)
  })

  return workspacePackagePaths
}

/**
 * Function to get package names from package.json files
 * @param packagePaths an array of package paths
 * @returns an array of package names
 */
export function getPackageNamesFromPaths(packagePaths: string[]): string[] {
  const packageNames = packagePaths
    .map((pkgPath) => {
      const packageJsonPath = path.join(pkgPath, 'package.json')
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8'),
      ) as PackageJson
      return packageJson.name
    })
    .filter((name): name is string => !!name) // Filter out undefined names

  return packageNames
}

/**
 * Function to get all workspace package names
 * @param cwd the current working directory
 * @returns an array of all workspace package names
 */
export function getWorkspacePackageNames(cwd: string): string[] {
  const rootPackageJson = getRootPackageJson(cwd)
  if (!rootPackageJson.workspaces) {
    throw new Error('No workspaces defined in the root package.json')
  }

  const workspacePackagePaths = getWorkspacePackagePaths(
    rootPackageJson.workspaces,
  )
  const packageNames = getPackageNamesFromPaths(workspacePackagePaths)

  return [
    ...packageNames,
    ...(rootPackageJson.name ? [rootPackageJson.name] : []),
  ]
}

/**
 * Function to update all package.json files in the workspace
 * @param cwd the current working directory
 * @param update the function to update the package.json
 * @param includeRoot whether to include the root package.json
 */
export async function updateWorkspacePackages(
  cwd: string,
  update: (
    parsedPackageJson: PackageJson,
    fullPath: string,
  ) => PackageJson | Promise<PackageJson>,
  includeRoot = false,
): Promise<void> {
  const rootPackageJson = getRootPackageJson(cwd)

  if (!rootPackageJson.workspaces) {
    throw new Error('No workspaces defined in the root package.json')
  }

  const workspacePackagePaths = getWorkspacePackagePaths(
    rootPackageJson.workspaces,
  )

  if (includeRoot) {
    workspacePackagePaths.push(cwd)
  }

  await Promise.all(
    workspacePackagePaths.map(async (pkgPath) => {
      const packageJsonPath = path.join(pkgPath, 'package.json')
      const packageJsonContent = await fsPromise.readFile(
        packageJsonPath,
        'utf-8',
      )
      const packageJson = JSON.parse(packageJsonContent) as PackageJson
      const updatedPackageJson = await update(packageJson, pkgPath)
      console.log(
        packageJson.name,
        updatedPackageJson.name,
        packageJson.name === updatedPackageJson.name,
      )
      if (packageJson !== updatedPackageJson) {
        await fsPromise.writeFile(
          packageJsonPath,
          JSON.stringify(updatedPackageJson, null, 2) + '\n',
        )
      }
    }),
  )
}

/**
 * Function to replace a string in a file
 * @param filePath path to the file
 * @param searchReplace an object with search and replace strings
 * @param ignoredFiles an array of file names to ignore
 */
export async function replaceInFile(
  filePath: string,
  searchReplace: Record<string, string>,
  ignoredFiles: string[] = [],
): Promise<void> {
  const extensions = ['.json', '.ts', '.tsx', '.js', '.jsx']

  if (!extensions.includes(path.extname(filePath))) {
    return
  }

  if (ignoredFiles.includes(path.basename(filePath))) {
    return
  }

  try {
    let data = await fsPromise.readFile(filePath, 'utf8')

    for (const [search, replace] of Object.entries(searchReplace)) {
      const regex = new RegExp(search, 'g')
      data = data.replace(regex, replace)
    }

    await fsPromise.writeFile(filePath, data, 'utf8')
    console.log(`Successfully updated ${filePath}`)
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err)
  }
}

/**
 * Function to traverse a directory and call a callback on each file
 * @param directory the directory to traverse
 * @param callback a function to call on each file
 * @param ignoredFolders an array of folder names to ignore
 */
export async function traverseDirectory(
  directory: string,
  callback: (fullPath: string) => Promise<void>,
  ignoredFolders: string[] = [],
): Promise<void> {
  try {
    const files = await fsPromise.readdir(directory)

    for (const file of files) {
      const fullPath = path.join(directory, file)
      const stats = await fsPromise.stat(fullPath)

      if (stats.isDirectory()) {
        if (!ignoredFolders.includes(file)) {
          await traverseDirectory(fullPath, callback, ignoredFolders)
        }
      } else if (stats.isFile()) {
        await callback(fullPath)
      }
    }
  } catch (err) {
    console.error(`Error processing directory ${directory}:`, err)
  }
}

/**
 * Function to update the prettier.config.js file
 * @param cwd the current working directory
 * @param newNamespace the new namespace to replace
 */
export async function updateNamespaceInPrettierConfig(
  cwd: string,
  namespace: string,
  newNamespace: string,
): Promise<void> {
  const filePath = path.join(cwd, '.prettierrc.cjs')

  try {
    const data = await fsPromise.readFile(filePath, 'utf8')

    const importOrderStart = data.indexOf('importOrder: [')
    const importOrderEnd = data.indexOf('],', importOrderStart)
    if (importOrderStart === -1 || importOrderEnd === -1) {
      console.error('importOrder array not found in file')
      return
    }

    const beforeImportOrder = data.substring(0, importOrderStart)
    const importOrderContent = data.substring(
      importOrderStart,
      importOrderEnd + 2,
    ) // Include '],'
    const afterImportOrder = data.substring(importOrderEnd + 2)

    const searchPattern = new RegExp(`${namespace}`, 'g')

    const updatedImportOrderContent = importOrderContent.replace(
      searchPattern,
      (match) => {
        return match.replace(namespace, newNamespace)
      },
    )

    // Reconstruct the file content
    const updatedData =
      beforeImportOrder + updatedImportOrderContent + afterImportOrder

    if (data !== updatedData) {
      await fsPromise.writeFile(filePath, updatedData, 'utf8')
      console.log(`Successfully updated ${filePath}`)
    } else {
      console.log(`No changes needed for ${filePath}`)
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err)
  }
}

/**
 * Returns the package manager used in the workspace
 * NPM is not supported, since it doesn't support the `workspace:` protocol.
 * @returns 'pnpm', 'bun' or 'yarn'
 */
export async function getPackageManager() {
  const pkg = getRootPackageJson(process.cwd())

  if (
    pkg.packageManager?.match(/pnpm/) ||
    fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'))
  ) {
    return 'pnpm'
  }

  if (fs.existsSync(path.join(process.cwd(), 'bun.lockb'))) {
    return 'bun'
  }

  // yarn is the default package manager
  return 'yarn'
}
