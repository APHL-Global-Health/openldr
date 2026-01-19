import * as utils from  '../../utils.js';
import { expect } from 'chai';

describe('OpenLDR Unsupported Content Type Test', function() {
  this.timeout(60000);

  let token;

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

  describe('Message Sending', function() {
    it('should test unsupported content type (application/yaml)', async function() {        
        const data = `test: data
version: 1.0
items:
  - name: test
`;
        try{
          const response = await utils.sendTestMessage(token, data, 'application/yaml');
          expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
        }
        catch(error){
          expect(error.response.data).to.have.property('error').and.to.be.equal('Unsupported content type');
        }
    });

    it('should test unsupported content type (application/protobuf)', async function() {        
        const data = `binary data here`;
        try{
          const response = await utils.sendTestMessage(token, data, 'application/protobuf');
          expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
        }
        catch(error){
          expect(error.response.data).to.have.property('error').and.to.be.equal('Unsupported content type');
        }
    });

    it('should test missing content-type header', async function() {        
        const data = `data without content type`;

        try{
          await utils.axiosInstance.post(
            `${utils.dataProcessingUrl}/data-processing/send-message`,
            data,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
        }
        catch(error){
          expect(error.response.data).to.have.property('error').and.to.be.equal('Unsupported content type');
        }
    }); 

    it('should test supported content type (text/plain)', async function() {        
        const data = 'This should work fine';

        const response = await utils.sendTestMessage(token, data, 'text/plain');
        expect(response).to.have.property('message').and.to.be.equal('Message successfully processed.');
    }); 
  });

});