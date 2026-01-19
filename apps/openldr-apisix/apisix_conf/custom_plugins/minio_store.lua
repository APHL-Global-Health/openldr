local core = require("apisix.core")
local jwt = require("resty.jwt")
local http = require("resty.http")
local cjson = require("cjson")
local date = require("socket.http").date
local resty_hmac = require('resty.hmac')
local resty_sha256 = require('resty.sha256')
local str = require('resty.string')
local socket = require("socket")

local plugin_name = "minio_store"

local schema = {
    type = "object",
    properties = {
        minio_url = { type = "string", description = "MinIO base URL" },
        access_key = { type = "string", description = "MinIO access key" },
        secret_key = { type = "string", description = "MinIO secret key" },
        jwt_secret = { type = "string", description = "JWT secret key for decoding token" },
        --region = { type = "string", description = "AWS region, e.g., us-east-1" },
    },
    required = { "minio_url", "access_key", "secret_key", "jwt_secret" },
}

local _M = {
    version = 0.1,
    priority = 10,
    name = plugin_name,
    schema = schema,
}

-- AWS Signature V4 Functions

local function get_iso8601_basic(timestamp)
    return os.date('!%Y%m%dT%H%M%SZ', timestamp)
end

local function get_iso8601_basic_short(timestamp)
    return os.date('!%Y%m%d', timestamp)
end

local function get_derived_signing_key(secret_key, timestamp, region, service)
    local k_date = resty_hmac:new('AWS4' .. secret_key, resty_hmac.ALGOS.SHA256)
    k_date:update(get_iso8601_basic_short(timestamp))
    k_date = k_date:final()

    local k_region = resty_hmac:new(k_date, resty_hmac.ALGOS.SHA256)
    k_region:update(region)
    k_region = k_region:final()

    local k_service = resty_hmac:new(k_region, resty_hmac.ALGOS.SHA256)
    k_service:update(service)
    k_service = k_service:final()

    local k_signing = resty_hmac:new(k_service, resty_hmac.ALGOS.SHA256)
    k_signing:update('aws4_request')
    return k_signing:final()
end

local function get_cred_scope(timestamp, region, service)
    return get_iso8601_basic_short(timestamp)
        .. '/' .. region
        .. '/' .. service
        .. '/aws4_request'
end

local function get_signed_headers()
    return 'host;x-amz-content-sha256;x-amz-date'
end

local function get_sha256_digest(s)
    local h = resty_sha256:new()
    h:update(s or '')
    return str.to_hex(h:final())
end

local function get_canonical_request(method, uri, host, payload_hash, signed_headers)
    return table.concat({
        method,
        uri,
        '', -- Query string
        'host:' .. host,
        'x-amz-content-sha256:' .. payload_hash,
        'x-amz-date:' .. get_iso8601_basic(ngx.time()),
        '', -- Empty line
        signed_headers,
        payload_hash
    }, '\n')
end

local function get_hashed_canonical_request(canonical_request)
    return get_sha256_digest(canonical_request)
end

local function get_string_to_sign(timestamp, region, service, hashed_canonical_request)
    return table.concat({
        'AWS4-HMAC-SHA256',
        get_iso8601_basic(timestamp),
        get_cred_scope(timestamp, region, service),
        hashed_canonical_request
    }, '\n')
end

local function get_signature(derived_signing_key, string_to_sign)
    local h = resty_hmac:new(derived_signing_key, resty_hmac.ALGOS.SHA256)
    h:update(string_to_sign)
    return h:final(nil, true)
end

local function get_authorization_header(access_key, credential_scope, signed_headers, signature)
    return table.concat({
        'AWS4-HMAC-SHA256 Credential=',
        access_key,
        '/',
        credential_scope,
        ', SignedHeaders=',
        signed_headers,
        ', Signature=',
        signature
    }, '')
end

-- Extract partner-id from JWT
local function extract_partner_id(jwt_token, jwt_secret)
    local decoded, err = jwt:verify(jwt_secret, jwt_token)
    if not decoded or err then
        return nil, nil, "Invalid JWT token: " .. (err or "unknown error")
    end

    local partner_id = decoded.payload["sub"]
    if not partner_id then
        return nil, nil, "partner_id (sub) not found in token"
    end

    return partner_id, decoded.payload, nil
end


local function extract_metadata_from_jwt(jwt_token, jwt_secret)
    local decoded, err = jwt:verify(jwt_secret, jwt_token)
    if not decoded or err then
        return nil, "Invalid JWT token: " .. (err or "unknown error")
    end

    return decoded.payload, nil
end


-- Function to upload to MinIO with AWS4 Signature
local function upload_to_minio(conf, bucket, key, body, metadata)
    local timestamp = ngx.time()
    local amz_date = get_iso8601_basic(timestamp)
    local date_stamp = get_iso8601_basic_short(timestamp)
    local service = 's3'
    --local region = conf.region
    local region = 'us-east-1'
    core.log.info("URL ", conf.url)
    local parsed_url = socket.url.parse(conf.minio_url)
    local host = parsed_url.host
    local path = parsed_url.path or "/"
    
    local uri = (path == "/" and "/" or path .. "/") .. bucket .. "/" .. key

    core.log.info("URuriL ", uri)

    local payload_hash = get_sha256_digest(body)
    core.log.info("payload_hash ", payload_hash)

    -- Create Canonical Request
    local canonical_request = get_canonical_request("PUT", uri, host, payload_hash, get_signed_headers())
    local hashed_canonical_request = get_hashed_canonical_request(canonical_request)
    core.log.info("hashed_canonical_request ", hashed_canonical_request)
    -- Create String to Sign
    local string_to_sign = get_string_to_sign(timestamp, region, service, hashed_canonical_request)
    core.log.info("string_to_sign ", string_to_sign)
    -- Derive Signing Key
    local signing_key = get_derived_signing_key(conf.secret_key, timestamp, region, service)
    core.log.info("signing_key ", signing_key)
    -- Calculate Signature
    local signature = get_signature(signing_key, string_to_sign)
    core.log.info("signature ", signature)
    -- Create Authorization Header
    local credential_scope = get_cred_scope(timestamp, region, service)
    local authorization = get_authorization_header(conf.access_key, credential_scope, get_signed_headers(), signature)
    core.log.info("authorization ", authorization)
    -- Prepare Headers
    local headers = {
        ["Content-Type"] = "application/json",
        ["x-amz-date"] = amz_date,
        ["x-amz-content-sha256"] = payload_hash,
        ["Authorization"] = authorization,
        ["Host"] = host,
    }
    -- Add metadata as headers
    if metadata then
        for key, value in pairs(metadata) do
            headers["x-amz-meta-" .. key] = tostring(value)
        end
    end
    -- Initialize HTTP client
    local httpc = http.new()
    httpc:set_timeout(5000) -- 5 seconds timeout

    -- Make the PUT request to MinIO
    local res, err = httpc:request_uri(conf.minio_url .. uri, {
        method = "PUT",
        body = body,
        headers = headers,
    })

    if not res then
        return false, "Failed to upload to MinIO: " .. err
    end

    if res.status >= 300 then
        return false, "MinIO returned status " .. res.status .. ": " .. res.body
    end

    return true, nil
end

-- Process Request Body
local function process_request_body()
    -- Read the request body
    local req_body, err = core.request.get_body()
    if not req_body then
        core.log.error("Failed to get request body: ", err)
        return 400, { message = "Invalid request body" }
    end

    -- Parse the JSON body
    local ok, json_body = pcall(cjson.decode, req_body)
    if not ok then
        core.log.error("Failed to parse JSON body: ", json_body)
        return 400, { message = "Invalid JSON format" }
    end

    -- Access fields from the JSON body
    local some_field = json_body["some_field"]
    core.log.info("some_field: ", some_field)

    -- Continue processing as needed
    -- ...

    return 200, { message = "Request processed successfully" }
end

-- Access Phase Handler
function _M.access(conf, ctx)
    -- Fetch JWT token from the Authorization header
    local auth_header = core.request.header(ctx, "Authorization")
    if not auth_header then
        core.log.error("Missing Authorization header")
        return 401, { message = "Missing Authorization header" }
    end

    local jwt_token = auth_header:match("Bearer%s+(.+)")
    if not jwt_token then
        core.log.error("Invalid Authorization header format")
        return 401, { message = "Invalid Authorization header format" }
    end

    -- Fetch consumer info
    local consumer = ctx.consumer
    if not consumer then
        core.log.error("Consumer not found")
        return 401, { message = "Invalid consumer" }
    end

    core.log.info("Consumer info: ", core.json.encode(consumer))

    if not consumer["username"] then
        core.log.error("Username not found in consumer")
        return 401, { message = "Invalid consumer" }
    end

    core.log.info("Consumer username: ", consumer["username"])

    -- Extract JWT secret dynamically
    local jwt_secret = consumer["plugins"]["jwt-auth"] and consumer["plugins"]["jwt-auth"]["secret"]
    if not jwt_secret then
        core.log.error("Missing JWT secret for consumer")
        return 401, { message = "Missing JWT secret for consumer" }
    end

    core.log.info("JWT secret found for consumer")

    -- Extract partner_id and metadata from the JWT
    local partner_id, metadata, err = extract_partner_id(jwt_token, jwt_secret)
    if not partner_id then
        core.log.error("Error extracting partner-id: ", err)
        return 401, { message = err }
    end

    core.log.info("Extracted partner-id: ", partner_id)
    core.log.info("Extracted metadata: ", core.json.encode(metadata))

    -- Continue with MinIO upload logic
    local bucket = "partner-" .. partner_id
    local key = tostring(math.floor(socket.gettime() * 1000)) .. ".json"

    -- Extract all metadata from the JWT
    local metadata, err = extract_metadata_from_jwt(jwt_token, jwt_secret)
    if not metadata then
        core.log.error("Error extracting metadata: ", err)
        return 401, { message = err }
    end

    core.log.info("Extracted metadata: ", core.json.encode(metadata))

    -- Fetch the body (assuming it's JSON)
    local req_body, err = core.request.get_body()
    if not req_body then
        core.log.error("Failed to retrieve request body: ", err)
        return 400, { message = "Failed to retrieve request body" }
    end
    

    core.log.info("Attempting to upload to MinIO at: ", conf.minio_url, " Bucket: ", bucket, " Key: ", key)

    -- Upload the message to MinIO
    local ok, upload_err = upload_to_minio(conf, bucket, key, req_body, metadata)
    if not ok then
        core.log.error("Failed to upload to MinIO: ", upload_err)
        return 500, { message = upload_err }
    end

    core.log.info("Message successfully uploaded to MinIO in bucket: ", bucket)

    -- Optionally, you can process the request body further or modify the response
    core.response.exit(200, { message = "Message stored successfully in bucket: " .. bucket })
end

return _M
