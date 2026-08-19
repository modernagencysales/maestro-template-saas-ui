export interface BillingAdapter {
  /**
   * Returns the customer ID.
   */
  findCustomerId: (params: {
    id?: string
    accountId?: string
    email?: string
  }) => Promise<string | null>

  /**
   * Only required if this is supported by the billing provider.
   */
  createCustomer?: (params: {
    accountId: string
    name?: string
    email?: string
  }) => Promise<string>

  /**
   * Only required if this is supported by the billing provider.
   */
  updateCustomer?: (params: {
    customerId: string
    accountId: string
    name?: string
    email?: string
  }) => Promise<void>

  /**
   * Returns the checkout URL to redirect the user to.
   */
  createCheckoutSession: (params: {
    customerId: string
    planId: string
    counts?: Record<string, number>
    successUrl: string
    cancelUrl: string
  }) => Promise<{
    url?: string | null
  }>

  /**
   * Returns the billing portal URL to redirect the user to.
   */
  createBillingPortalSession?: (params: {
    customerId: string
    returnUrl: string
  }) => Promise<{
    url?: string | null
  }>

  /**
   * Change the plan, status or feature counts of a subscription.
   */
  updateSubscription?: (params: {
    /**
     * The subscription ID.
     */
    subscriptionId: string
    /**
     * The current planId or id to downgrade/upgrade to.
     */
    planId: string
    /**
     * Update the subscription status.
     */
    status?: string
    /**
     * The feature totals.
     */
    counts?: Record<string, number>
  }) => Promise<void>

  /**
   * Returns the invoices of a customer.
   */
  listInvoices?: (params: { customerId: string }) => Promise<
    {
      number: string
      date: Date
      status: string
      total: number
      currency: string
      url?: string
    }[]
  >

  /**
   * Register the usage of a feature.
   */
  registerUsage?: (params: {
    customerId: string
    featureId: string
    quantity: number
  }) => Promise<void>
}
