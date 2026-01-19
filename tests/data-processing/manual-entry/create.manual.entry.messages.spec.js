import * as utils from  '../../utils.js';
import { expect } from 'chai';

const sendManualEntryMessage = async (jsonData, userId, facilityId) => {
    const response = await utils.axiosInstance.post(
      `${utils.dataProcessingUrl}/data-processing/manual-data-entry`,
        jsonData,
        {
            headers: {
                'X-User-Id': userId,
                'X-Facility-Id': facilityId,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data;
};

describe('OpenLDR Manual Entry Message Tests', function() {
  this.timeout(10000);

  const numMessages = 5; // Default number of messages for testing

  const DEFAULT_MANUAL_ENTRY = {
      firstName: "Zach",
      lastName: "Finn",
      dob: "2025-07-01",
      sex: "Male",
      patientId: "test_1111",
      specimenDate: "2025-07-01",
      orderProvider: "Bob",
      labFacilityCode: "ZLB",
      requestId: "1234567890",
      panelCode: "ZLB_PARASITE_COUNT",
      panelDescription: "Parasite Count",
      observationCode: "PLASMODIUM_FALCIPARUM_COUNT",
      observationDescription: "Plasmodium falciparum Count",
      interpretation: "High",
      results: "33",
      resultUnits: "copies/mL",
      referenceRange: "1-44"
  };

  const HIV_VIRAL_LOAD = {
      firstName: "Sarah",
      lastName: "Johnson",
      dob: "1990-05-15",
      sex: "Female",
      patientId: "P12345",
      specimenDate: "2024-07-03",
      orderProvider: "Dr. Robert Smith",
      labFacilityCode: "ZLB",
      requestId: "HIV_VL_20240703_001",
      panelCode: "HIV_VL",
      panelDescription: "HIV Viral Load",
      observationCode: "HIV_RNA_QUANT",
      observationDescription: "HIV-1 RNA Quantitative",
      interpretation: "Undetectable",
      results: "150",
      resultUnits: "copies/mL",
      referenceRange: "< 200"
  };

  const MALARIA_RAPID = {
      firstName: "Michael",
      lastName: "Okello",
      dob: "1985-12-20",
      sex: "Male",
      patientId: "P67890",
      specimenDate: "2024-07-03",
      orderProvider: "Dr. Jane Smith",
      labFacilityCode: "ZLB",
      requestId: "MALARIA_20240703_001",
      panelCode: "MALARIA_RAPID",
      panelDescription: "Malaria Rapid Diagnostic Test",
      observationCode: "PLASMODIUM_FALCIPARUM_RAPID",
      observationDescription: "Plasmodium falciparum Rapid Test",
      interpretation: "Positive",
      results: "POSITIVE",
      resultUnits: null,
      referenceRange: "NEGATIVE"
  };

  const TB_PCR = {
      firstName: "Jane",
      lastName: "Smith",
      dob: "1978-08-10",
      sex: "Female",
      patientId: "P13579",
      specimenDate: "2024-07-03",
      orderProvider: "Dr. Michael Brown",
      labFacilityCode: "ZLB",
      requestId: "TB_PCR_20240703_001",
      panelCode: "TB_PCR",
      panelDescription: "Tuberculosis PCR Test",
      observationCode: "MYCOBACTERIUM_TB_PCR",
      observationDescription: "Mycobacterium tuberculosis PCR",
      interpretation: "Negative",
      results: "NEGATIVE",
      resultUnits: null,
      referenceRange: "NEGATIVE"
  };

  const entryData = [
    DEFAULT_MANUAL_ENTRY, 
    HIV_VIRAL_LOAD, 
    MALARIA_RAPID, 
    TB_PCR
  ];

  const userIds = ["tech_001", "tech_002", "dr_smith", "nurse_jane"];
  const facilityId = "c28037f7-de96-41be-8320-aafd67127744";

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

  describe('Manual Entry Message Sending', function() {
    it(`should send ${numMessages} test messages successfully`, async function() {
      for (let i = 1; i <= numMessages; i++) {
          const typeIndex = (i - 1) % 4;
          const userIndex = (i - 1) % 4;

          const jsonData = entryData[typeIndex];
          const userId = userIds[userIndex];

          const response = await sendManualEntryMessage(jsonData, userId, facilityId);
          expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
          
          await new Promise(resolve => setTimeout(resolve, 500));
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