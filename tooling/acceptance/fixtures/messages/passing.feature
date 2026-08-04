@journey_messages_fixture @admitted
Feature: Verify a genuine Cucumber Messages stream

  @ui @covers_messages_fixture
  Scenario Outline: Perform and observe one fixture action
    When I increment the fixture counter by <amount>
    Then the fixture counter is <expected>

    Examples:
      | amount | expected |
      |      1 |        1 |
