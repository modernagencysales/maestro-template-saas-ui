import { afterEach, describe, expect, it } from 'vitest'

import {
  assertProConsumerFixture,
  createTemporaryConsumerDirectory,
  findConsumerDependency,
  installProConsumerFixture,
  reinstallProConsumerFixture,
  removeConsumerDirectory,
  snapshotProject,
} from './fixture'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(removeConsumerDirectory))
})

describe('generated Pro registry consumer', () => {
  it('resolves Saas UI dependencies from the current workspace', async () => {
    await expect(
      findConsumerDependency('@saas-ui/chakra-preset'),
    ).resolves.toBeTruthy()
  })

  it('installs every Pro item and all public dependencies deterministically', async () => {
    const firstCwd = await createTemporaryConsumerDirectory()
    temporaryDirectories.push(firstCwd)
    const first = await installProConsumerFixture(firstCwd)
    await assertProConsumerFixture(first)
    await reinstallProConsumerFixture(first)

    const secondCwd = await createTemporaryConsumerDirectory()
    temporaryDirectories.push(secondCwd)
    const second = await installProConsumerFixture(secondCwd)
    await assertProConsumerFixture(second)
    expect(await snapshotProject(second.cwd)).toEqual(
      await snapshotProject(first.cwd),
    )
  })
})
