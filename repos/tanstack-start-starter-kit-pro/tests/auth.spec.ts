import { expect, test } from '@playwright/test'

test('login page loads', async ({ page }) => {
  await page.goto('/')

  // Wait for redirect to login page
  await page.waitForURL('**/login')

  // Check that the page title is set correctly
  await expect(page).toHaveTitle(/Login/)

  // Check that the login page is visible
  await expect(page.getByRole('heading', { name: /Log in/i })).toBeVisible()
})
