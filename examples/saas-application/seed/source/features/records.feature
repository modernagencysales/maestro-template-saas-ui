Feature: Manage workspace records
  A workspace member can manage records from the authenticated CLI.

  Scenario: Create and list in CLI
    Given the contracts workspace is ready
    When I create a record named "Launch checklist" from the CLI
    Then listing records from the CLI includes "Launch checklist"

  Scenario: Reject a missing API key
    Given the contracts workspace is ready
    When I try to create a record named "Rejected without a key" without a CLI API key
    Then the CLI reports that an API key is required
    And listing records from the CLI does not include "Rejected without a key"

  Scenario: Reject a cross-workspace write without side effects
    Given the contracts workspace is ready
    When I try to create a record named "Rejected across workspaces" for another workspace
    Then the CLI reports that the API key is bound to a different workspace
    And listing records for the other workspace does not include "Rejected across workspaces"
