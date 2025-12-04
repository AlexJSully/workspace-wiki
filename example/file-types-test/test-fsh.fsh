// test-fsh.fsh
// This is a FHIR Shorthand (FSH) file for testing Workspace Wiki file type support

// FHIR Shorthand is a domain-specific language for defining FHIR resources
// Used in healthcare interoperability to create FHIR Implementation Guides

Profile: ExamplePatientProfile
Parent: Patient
Id: example-patient
Title: "Example Patient Profile"
Description: "An example patient profile for testing purposes"
* name 1..* MS
* name.given 1..* MS
* name.family 1..1 MS
* birthDate 1..1 MS
* active 1..1 MS

Instance: ExamplePatientInstance
InstanceOf: ExamplePatientProfile
Usage: #example
Title: "Example Patient Instance"
Description: "An example patient instance for testing"
* name.given = "John"
* name.family = "Doe"
* birthDate = "1980-01-01"
* active = true

ValueSet: ExampleValueSet
Id: example-value-set
Title: "Example Value Set"
Description: "An example value set for testing"
* include codes from system http://example.org/fhir/CodeSystem/example-codes
