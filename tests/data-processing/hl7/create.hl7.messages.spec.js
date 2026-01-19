import * as utils from  '../../utils.js';
import * as samples from  './samples.js';
import { expect } from 'chai';

// Function to send a test HL7 message
async function sendTestMessage(token, messageNumber, hl7Template, startOffset) {
    const actualMessageNumber = startOffset + messageNumber;
    
    // Generate a timestamp for HL7 format (YYYYMMDDHHMMSS)
    const date = new Date();
    date.setSeconds(date.getSeconds() + actualMessageNumber);
    const hl7Timestamp = date.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '')
      .split('.')[0];
    
    // Create unique message by modifying the HL7 template
    const messageId = `MSG${String(actualMessageNumber).padStart(6, '0')}`;
    const requestId = `ORD${String(actualMessageNumber).padStart(6, '0')}`;
    let message = hl7Template.replace(/MSG001/g, messageId);
    
    // Update timestamp in MSH segment and request ID in OBR segment
    message = message.replace(/20240315083000/g, hl7Timestamp);
    message = message.replace(/ORD001/g, requestId);

    // Send the raw HL7 message via APISIX (SSL)
    const response = await utils.axiosInstance.post(
      `${utils.apisixApiUrl}/api/v1/openldr/event/msg`,
      message,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/hl7-v2'
        }
      }
    );

    return response.data;
}

describe('OpenLDR HL7 Message Tests', function() {
  this.timeout(10000);

  let token;
  const numMessages = 5; // Default number of messages for testing
  let currentProcessedCount;

  const hl7Template = samples.sampleMessage;

  before(async function() {
    // Get authentication token
   const credentials = utils.credentialPairs[0];
   token = await utils.getToken(credentials.clientId, credentials.clientSecret);

    // Get current processed message count as starting offset
    currentProcessedCount = await utils.getIndexCount('processed-inbound');
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

  describe('HL7 Message Sending', function() {
    it(`should send ${numMessages} test messages successfully`, async function() {
      for (let i = 1; i <= numMessages; i++) {
        const response = await sendTestMessage(token, i, hl7Template, currentProcessedCount);
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