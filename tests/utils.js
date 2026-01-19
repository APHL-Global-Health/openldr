import https from 'https';
import axios from 'axios';

export const dataProcessingUrl = 'https://127.0.0.1/data-processing';
export const keycloakUrl = 'https://127.0.0.1/keycloak';
export const keycloakRealm = 'openldr-realm';
export const opensearchUrl = 'https://127.0.0.1/opensearch';
export const apisixApiUrl = 'https://127.0.0.1/apisix-gateway';
export const entityServicesUrl = 'https://127.0.0.1/entity-services';

export const credentialPairs = [
    {
        clientId: '216b8021-92b3-4903-85a9-cc27fdf33b84',
        clientSecret: 'tWEwsAqCgT9rncbeaI6z7c1umLXCbman'
    },
    {
        clientId: '4a11d2a2-d1a4-4127-a65e-ced3ab5802af',
        clientSecret: 'dKyjHcZYqGq8poJ73LwLdnTPaFrIwbUE'
    }
];


// Create axios instance with SSL disabled for self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // Ignore self-signed certificate errors
});

export const axiosInstance = axios.create({
  httpsAgent: httpsAgent
});

// Function to get Keycloak token via APISIX (SSL)
export async function getToken(clientId, clientSecret) {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await axiosInstance.post(
      `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.access_token;
}

// Function to get index count
export async function getIndexCount(index) {
    try {
      const response = await axiosInstance.get(`${opensearchUrl}/${index}/_count`);
      return response.data.count;
    } catch (error) {
      return 0;
    }
}

export async function listIndexes() {
    const response = await axiaxiosInstanceos.get(`${opensearchUrl}/_cat/indices?v`);
    return response.data;
};

export async function checkOpensearch() {
    try {
        const response = await axiosInstance.get(`${opensearchUrl}/_cluster/health`);
        const status = response.data.status;
        return status === 'green' || status === 'yellow';
    } catch (error) {
        return false;
    }
};

export async function checkEntityService() {
    try {
        await axiosInstance.get(`${entityServicesUrl}/facility`);
        return true;
    } catch (error) {
        return false;
    }
};

// Function to send test message
export async function sendTestMessage(token, data, contentType = 'application/fhir+json') {
    const response = await axiosInstance.post(
    `${dataProcessingUrl}/data-processing/send-message`,
    data,
    {
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType
        }
    }
    );

    
    return response.data;
}
