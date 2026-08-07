Feature: Manage workspace records
  A workspace member can manage the same records from the app and the CLI.

  @cross_surface
  Scenario: A record created in the app is available from the CLI
    Given the contracts workspace is ready
    When I create a record named "Launch checklist" in the app
    Then listing records from the CLI includes "Launch checklist"

  @cross_surface
  Scenario: A record created from the CLI is available in the app
    Given the contracts workspace is ready
    When I create a record named "Release notes" from the CLI
    Then the app shows a record named "Release notes"

  @cross_surface
  Scenario: A missing CLI API key cannot create a record
    Given the contracts workspace is ready
    When I try to create a record named "Rejected without a key" without a CLI API key
    Then the CLI reports that an API key is required
    And the app does not show "Rejected without a key"

  @cross_surface
  Scenario: A workspace-bound key cannot mutate another workspace
    Given the contracts workspace is ready
    When I try to create a record named "Rejected across workspaces" for another workspace
    Then the CLI reports that the API key is bound to a different workspace
    And the app does not show "Rejected across workspaces"
