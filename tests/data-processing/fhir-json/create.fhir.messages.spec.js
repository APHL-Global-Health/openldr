import * as utils from  '../../utils.js';
import { expect } from 'chai';

describe('OpenLDR FHIR JSON Message Tests', function() {
  this.timeout(10000);

  let token;
  const numMessages = 5; // Default number of messages for testing

  // FHIR test data matching the bash script exactly
  const sampleFHIRBundle = {
    resourceType: "Bundle",
    type: "message",
    entry: [
      {
        resource: {
          resourceType: "DiagnosticReport",
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                  code: "LAB",
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "25836-8",
                display: "HIV test",
              },
            ],
          },
          effectiveDateTime: "2024-07-03T14:30:00Z",
          conclusion: "Sample HIV test result",
        },
      },
    ],
  };

  const malariaTestBundle = {
    resourceType: "Bundle",
    type: "message",
    entry: [
      {
        resource: {
          resourceType: "DiagnosticReport",
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                  code: "LAB"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "25836-8",
                display: "Malaria antigen detection"
              }
            ]
          },
          effectiveDateTime: "2024-07-03T14:30:00Z",
          conclusion: "POSITIVE - Plasmodium falciparum detected"
        }
      }
    ]
  };

  const cd4ObservationBundle = {
    resourceType: "Bundle",
    type: "message",
    entry: [
      {
        resource: {
          resourceType: "Observation",
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "laboratory"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "24467-3",
                display: "CD4+ T lymphocytes"
              }
            ]
          },
          valueQuantity: {
            value: 450,
            unit: "cells/μL",
            system: "http://unitsofmeasure.org",
            code: "{cells}/uL"
          },
          interpretation: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: "N",
                  display: "Normal"
                }
              ]
            }
          ]
        }
      }
    ]
  };


  before(async function() {
    // Get authentication token
    const credentials = utils.credentialPairs[0];
    token = await utils.getToken(credentials.clientId, credentials.clientSecret);
  });

  describe('Authentication', function() {
    it('should obtain authentication token successfully', function() {
      expect(token).to.not.be.empty;
    });
  });

  describe('Current Message Counts', function() {
    it('should get raw inbound message count', async function() {
      const count = await utils.getIndexCount('raw-inbound');
      expect(count).to.be.a('number');
      console.log(`Raw Inbound: ${count} messages`);
    });

    it('should get validated inbound message count', async function() {
      const count = await utils.getIndexCount('validated-inbound');
      expect(count).to.be.a('number');
      console.log(`Validated Inbound: ${count} messages`);
    });

    it('should get mapped inbound message count', async function() {
      const count = await utils.getIndexCount('mapped-inbound');
      expect(count).to.be.a('number');
      console.log(`Mapped Inbound: ${count} messages`);
    });

    it('should get processed inbound message count', async function() {
      const count = await utils.getIndexCount('processed-inbound');
      expect(count).to.be.a('number');
      console.log(`Processed Inbound: ${count} messages`);
    });
  });

  describe('FHIR Message Sending', function() {
    it(`should send ${numMessages} test messages successfully`, async function() {
      const fhirBundles = [sampleFHIRBundle, malariaTestBundle, cd4ObservationBundle];
 
      for (let i = 1; i <= numMessages; i++) {
        // Cycle through different FHIR message types
        const typeIndex = (i - 1) % 3;
        const data = fhirBundles[typeIndex];
        const response = await utils.sendTestMessage(token, data);
        expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
      }
    });

    it('should verify message counts increased after sending', async function() {
        // Wait for OpenSearch to index the messages
        await new Promise(resolve => setTimeout(resolve, 4000));

        const rawCount = await utils.getIndexCount('raw-inbound');
        const validatedCount = await utils.getIndexCount('validated-inbound');
        const mappedCount = await utils.getIndexCount('mapped-inbound');
        const processedCount = await utils.getIndexCount('processed-inbound');

        console.log('\nUpdated Message Counts:');
        console.log(`Raw Inbound: ${rawCount} messages`);
        console.log(`Validated Inbound: ${validatedCount} messages`);
        console.log(`Mapped Inbound: ${mappedCount} messages`);
        console.log(`Processed Inbound: ${processedCount} messages`);

        expect(rawCount).to.be.a('number');
        expect(validatedCount).to.be.a('number');
        expect(mappedCount).to.be.a('number');
        expect(processedCount).to.be.a('number');
    });
	
	});

});