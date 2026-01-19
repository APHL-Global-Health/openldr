import * as utils from  '../utils.js';
import { expect } from 'chai';

const PROJECT_ID = "5cdc2f8c-fbca-4bc5-9aff-624d7790cfc0";
const USE_CASE_ID = "dab96a2e-ec76-418d-b37c-119e24ea688a";
const FACILITY_ID = "0ef76341-ae6d-43ad-bc3b-f8c64ccfb884";

const createTestDataFeed = async (testName, dataFeedName, facilityId, schemaPluginId, mapperPluginId, recipientPluginId) => {
    const payload = {
        dataFeedName: dataFeedName,
        facilityId: facilityId,
        schemaPluginId: schemaPluginId,
        mapperPluginId: mapperPluginId,
        recipientPluginId: recipientPluginId,
        projectId: PROJECT_ID,
        useCaseId: USE_CASE_ID,
        isEnabled: true
    };

    const response = await utils.axiosInstance.post(
        `${utils.entityServicesUrl}/dataFeed/create-dataFeed`,
        payload,
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
      );
    return response.data;
};

describe('OpenLDR Data Feed Creation Test Script', function() {
  this.timeout(10000);

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

  describe('Entity service availability', function() {
    it('should obtain availability of service', async function() {
      const response = await utils.checkEntityService();
      expect(response).to.be.equal(true);
    });
  });

  describe('Data feed creation', function() {
    it('should create data feed with all plugins as null', async function() { 
      const response = await createTestDataFeed(
          'All plugins as null',
          'Test DataFeed - All Null Plugins',
          FACILITY_ID,
          null,
          null,
          null
        );

      expect(response).to.have.property('message').and.to.be.equal('Data feed created successfully');
    });

    it('should create data feed with all plugins as empty strings', async function() { 
      const response = await createTestDataFeed(
          'All plugins as empty strings',
          'Test DataFeed - Empty String Plugins',
          FACILITY_ID,
          '',
          '',
          ''
        );

      expect(response).to.have.property('message').and.to.be.equal('Data feed created successfully');
    });

    it('should create data feed with mixed null and empty values', async function() { 
      const response = await createTestDataFeed(
          'Mixed null and empty values',
          'Test DataFeed - Mixed Values',
          FACILITY_ID,
          null,
          '',
          null
        );

      expect(response).to.have.property('message').and.to.be.equal('Data feed created successfully');
    });

    it('should create data feed with schema plugin only (manual entry simulation)', async function() { 
      const response = await createTestDataFeed(
          'Schema plugin only (manual entry simulation)',
          'Test DataFeed - Manual Entry',
          FACILITY_ID,
          null,
          null,
          null
        );

      expect(response).to.have.property('message').and.to.be.equal('Data feed created successfully');
    });
  });

});