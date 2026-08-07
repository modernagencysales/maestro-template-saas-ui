Feature: Manage workspace records
  A workspace member can manage the same records from the app and the CLI.

  Scenario: Create in UI and read in CLI
    Given the contracts workspace is ready
    When I create a record named "Launch checklist" in the app
    Then listing records from the CLI includes "Launch checklist"

  Scenario: Create in CLI and read in UI
    Given the contracts workspace is ready
    When I create a record named "Release notes" from the CLI
    Then the app shows a record named "Release notes"

  Scenario: Reject a missing API key
    Given the contracts workspace is ready
    When I try to create a record named "Rejected without a key" without a CLI API key
    Then the CLI reports that an API key is required
    And the app does not show "Rejected without a key"

  Scenario: Reject a cross-workspace write without side effects
    Given the contracts workspace is ready
    When I try to create a record named "Rejected across workspaces" for another workspace
    Then the CLI reports that the API key is bound to a different workspace
    And listing records for the other workspace does not include "Rejected across workspaces"
