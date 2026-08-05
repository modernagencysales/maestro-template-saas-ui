@required
Feature: Manage workspace records
  A workspace member can manage the same records from the app and the CLI.

  @cross_surface
  Scenario: A record created in the app is available from the CLI
    Given the contracts workspace is ready
    When I create a record named "Launch checklist" in the app
    Then listing records from the CLI includes "Launch checklist"
