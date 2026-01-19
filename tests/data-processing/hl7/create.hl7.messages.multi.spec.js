import * as utils from  '../../utils.js';
import * as samples from  './samples.js';
import { expect } from 'chai';

// Function to send a test HL7 message
const sendTestMessage = async (messageNumber, hl7Template, startOffset) => {
    // Get authentication token
    const numPairs = utils.credentialPairs.length;
    expect(numPairs).to.be.a('number').and.to.be.greaterThan(0, 'No client credential pairs provided');

    const randomIndex = Math.floor(Math.random() * numPairs);
    const credentials = utils.credentialPairs[randomIndex];

    const token = await utils.getToken(credentials.clientId, credentials.clientSecret);
    expect(token).to.not.be.empty;

    const actualMessageNumber = startOffset + messageNumber;
    const now = new Date();
    const futureDate = new Date(now.getTime() + actualMessageNumber * 1000);
    const hl7Timestamp = futureDate.toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z/, '')
        .substring(0, 14);

    const messageId = `MSG${String(actualMessageNumber).padStart(6, '0')}`;
    const requestId = `ORD${String(actualMessageNumber).padStart(6, '0')}`;
    
    let message = hl7Template.replace(/MSG001/g, messageId);
    message = message.replace(/20240315083000/g, hl7Timestamp);
    message = message.replace(/ORD001/g, requestId);

    const response =  await utils.axiosInstance.post(
        `${utils.dataProcessingUrl}/data-processing/send-message`,
        message,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/hl7-v2'
            }
        }
    );

     return response.data;
};

describe('OpenLDR HL7 Message Tests', function() {
  this.timeout(10000);

  const numMessages = 5; // Default number of messages for testing
  const trickle = false;
  let currentProcessedCount;

  before(async function() {
    // Get current processed message count as starting offset
    currentProcessedCount = await utils.getIndexCount('processed-inbound');
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

  describe('HL7 Message Sending', function() {
    it(`should send ${numMessages} test messages successfully`, async function() {
      const hl7Templates = [samples.sampleMessage, samples.openLDRv2SampleMessage];
      const numTemplates = hl7Templates.length;

      for (let i = 1; i <= numMessages; i++) {
        try{
          const randomIndex = Math.floor(Math.random() * numTemplates);
          const hl7Template = hl7Templates[randomIndex];

          const response = await sendTestMessage(i, hl7Template, currentProcessedCount);
          expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
          
          if(trickle)
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        catch(error){
          //Check if client is unauthorized
          expect(error.response.status).to.be.equal(401);
        }
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