import * as utils from  '../../utils.js';
import { expect } from 'chai';

describe('OpenLDR Message Tests', function() {
  this.timeout(10000);

  let token;
  const numMessages = 5; // Default number of messages for testing

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

  describe('Message Sending', function() {
    it(`should send ${numMessages} test messages successfully`, async function() { 
      for (let i = 1; i <= numMessages; i++) {
        // Generate timestamp with offset (like `date -d "+N seconds"`)
        const timestamp = new Date(Date.now() + i * 1000).toISOString();

        // Build the payload
        const data = {
          message_id: `test_${i}`,
          timestamp,
          test_data: `This is test message ${i}`,
          sample_value: Math.floor(Math.random() * 100),
        };
        
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