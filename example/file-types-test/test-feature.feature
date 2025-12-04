# test-feature.feature
# This is a Gherkin feature file for BDD testing in Workspace Wiki

Feature: Workspace Wiki File Type Support
  As a developer
  I want to test different file types
  So that the Workspace Wiki extension can handle various documentation formats

  Background:
    Given the Workspace Wiki extension is installed
    And the workspace contains the file-types-test directory

  Scenario: Display supported file types in tree view
    Given I have opened a workspace with documentation files
    When I view the Workspace Wiki tree
    Then I should see all supported file types listed
    And the files should be properly ordered

  Scenario: Open a markdown file in preview mode
    Given I have a markdown file in the workspace
    When I click on the file in the Workspace Wiki tree
    Then the file should open in preview mode
    And I should see the rendered markdown content

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

  Scenario: Refresh tree view
    Given I have modified documentation files
    When I click the refresh button
    Then the tree view should update
    And show the latest file structure
