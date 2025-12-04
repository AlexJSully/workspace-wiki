# test-feature.feature
# This is a Gherkin feature file for BDD testing in Workspace Wiki

Feature: Workspace Wiki File Type Support
  As a developer
  I want to test different file types
  So that the Workspace Wiki extension can handle various documentation formats

  Background:
    Given the Workspace Wiki extension is installed
    And the workspace contains the file-types-test directory

  Scenario Outline: Handle different file extensions
    Given I have a file with extension "<extension>"
    When the Workspace Wiki scans the workspace
    Then the file should be "<visibility>" in the tree view

    Examples:
      | extension | visibility |
      | .md       | visible    |
      | .txt      | visible    |
      | .html     | visible    |
      | .js       | hidden     |
      | .py       | hidden     |
      | .fhirpath | hidden     |
      | .fsh      | hidden     |
