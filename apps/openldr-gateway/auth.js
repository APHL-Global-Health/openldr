async function introspect(r) {
    //  r.return(200, njs.version);
    //  r.return(401, JSON.stringify({ error: 'Token inactive' }));

    const authHeader = r.headersIn.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        r.error('No authorization header provided');
        r.return(401, JSON.stringify({ error: 'No token provided' }));
        return;
    }
    
    const token = authHeader.substring(7);
    
    const keycloakUrl = r.variables.KEYCLOAK_BASE_URL;
    const keycloakRealm = r.variables.KEYCLOAK_REALM;
    const clientId = r.variables.KEYCLOAK_CLIENT_ID;
    const clientSecret = r.variables.KEYCLOAK_CLIENT_SECRET;
    
    const introspectUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token/introspect`;
    
    const body = `token=${encodeURIComponent(token)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
    
    try {
        const response = await ngx.fetch(introspectUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body,
            verify: false  // Disable SSL verification for self-signed certs
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            r.error('Error response: ' + errorText);
            r.return(401, JSON.stringify({ 
                error: 'Introspection failed',
                status: response.status,
                body: errorText
            }));
            return;
        }
        
        const responseText = await response.text();
        
        const data = JSON.parse(responseText);

        if (!data.active) {
            r.return(401, JSON.stringify({ error: 'Token inactive' }));
            return;
        }
        
        // Set headers for downstream services
        r.headersOut['X-Auth-User'] = data.username || '';
        r.headersOut['X-Auth-Email'] = data.email || '';
        r.headersOut['X-Auth-Sub'] = data.sub || '';
        
        if (data.realm_access && data.realm_access.roles) {
            r.headersOut['X-Auth-Roles'] = JSON.stringify(data.realm_access.roles);
        }
        
        r.return(200, 'OK');
        
    } catch (e) {
        r.error('=== AUTH EXCEPTION ===');
        r.error('Error type: ' + e.name);
        r.error('Error message: ' + e.message);
        r.error('Error stack: ' + e.stack);
        r.return(500, JSON.stringify({ 
            error: 'Authentication service error',
            type: e.name,
            message: e.message
        }));
    }
}

export default { introspect };