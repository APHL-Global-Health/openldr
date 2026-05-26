import axios from "axios";

class OCLService {
  public batchSize: number;
  public delayBetweenBatches: number;
  public defaultOclUrl: string;

  constructor(oclUrl: string) {
    // Default to the online OCL instance
    // const defaultUrl = "https://api.openconceptlab.org";
    this.batchSize = 100; // Number of concepts per batch
    this.delayBetweenBatches = 1000; // 1 second delay between batches to avoid rate limiting

    // Validate and normalize the default OCL URL during initialization
    this.defaultOclUrl = this.validateOclUrl(oclUrl);
  }

  /**
   * Validate and normalize OCL URL format
   * @param {string} oclUrl - The OCL URL to validate
   * @returns {string} Normalized URL without trailing slash
   * @throws {Error} If URL is invalid
   */
  validateOclUrl(oclUrl: string) {
    if (!oclUrl || typeof oclUrl !== "string") {
      throw new Error("OCL URL must be a non-empty string");
    }

    try {
      const parsedUrl = new URL(oclUrl);

      // Ensure hostname exists
      if (!parsedUrl.hostname) {
        throw new Error("OCL URL must have a valid hostname");
      }

      // Support both HTTP and HTTPS (for internal/development servers)
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error(
          `OCL URL must use HTTP or HTTPS protocol. Received: ${parsedUrl.protocol}`,
        );
      }

      // Remove trailing slash to prevent double slashes in API paths
      const normalizedUrl = oclUrl.replace(/\/+$/, "");

      // console.log(`OCL URL validated and normalized: ${normalizedUrl}`);
      return normalizedUrl;
    } catch (error: any) {
      if (error instanceof TypeError) {
        // Native URL constructor throws TypeError for invalid URLs
        throw new Error(`Invalid OCL URL format: ${oclUrl}. ${error.message}`);
      }
      // Re-throw our custom validation errors
      throw error;
    }
  }

  /**
   * Fetch concepts from OCL with batch processing
   * @param {string} oclUrl - OCL instance URL (optional, defaults to online)
   * @param {string} orgId - Organization ID
   * @param {string} sourceId - Source ID
   * @param {Object} auth - Authentication object {type: 'token'|'basic'|'none', token?: string, username?: string, password?: string}
   * @param {number} limit - Number of concepts to fetch (default 1000)
   * @returns {Promise<Array>} Array of concepts
   */
  async fetchConcepts(
    oclUrl: string,
    orgId: string,
    sourceId: string,
    auth = { type: "none" },
    limit = 1000,
  ) {
    try {
      // Validate and normalize custom OCL URL if provided
      const baseUrl = oclUrl ? this.validateOclUrl(oclUrl) : this.defaultOclUrl;
      const url = `${baseUrl}/orgs/${orgId}/sources/${sourceId}/concepts/`;

      console.log(`Starting batch fetch from OCL: ${url}`);
      console.log(
        `Auth type: ${auth.type}, Total limit: ${limit}, Batch size: ${this.batchSize}`,
      );

      let allConcepts: any = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allConcepts.length < limit) {
        const batchLimit = Math.min(this.batchSize, limit - allConcepts.length);

        console.log(
          `Fetching batch: offset=${offset}, limit=${batchLimit}, total fetched=${allConcepts.length}`,
        );

        const batchConcepts = await this.fetchBatch(
          url,
          auth,
          offset,
          batchLimit,
        );

        if (batchConcepts && batchConcepts.length > 0) {
          allConcepts = allConcepts.concat(batchConcepts);
          offset += batchConcepts.length;

          // Check if we got fewer concepts than requested (end of data)
          if (batchConcepts.length < batchLimit) {
            hasMore = false;
          }

          // Add delay between batches to avoid rate limiting
          if (hasMore && allConcepts.length < limit) {
            await this.delay(this.delayBetweenBatches);
          }
        } else {
          hasMore = false;
        }
      }

      console.log(
        `Successfully fetched ${allConcepts.length} concepts from OCL in batches`,
      );
      return allConcepts;
    } catch (error: any) {
      console.error("Error fetching concepts from OCL:", error.message);
      if (error.response) {
        console.error("OCL Response status:", error.response.status);
        console.error("OCL Response data:", error.response.data);
      }
      throw new Error(`Failed to fetch concepts from OCL: ${error.message}`);
    }
  }

  /**
   * Fetch mappings for a specific source from OCL
   * @param {string} oclUrl - OCL instance URL (optional, defaults to online)
   * @param {string} orgId - Organization ID
   * @param {string} sourceId - Source ID
   * @param {Object} auth - Authentication object
   * @param {number} limit - Number of mappings to fetch (default 1000)
   * @returns {Promise<Array>} Array of mappings
   */
  async fetchMappings(
    oclUrl: string,
    orgId: string,
    sourceId: string,
    auth = { type: "none" },
    limit = 1000,
  ) {
    try {
      // Validate and normalize custom OCL URL if provided
      const baseUrl = oclUrl ? this.validateOclUrl(oclUrl) : this.defaultOclUrl;
      const url = `${baseUrl}/orgs/${orgId}/sources/${sourceId}/mappings/`;

      console.log(`Starting batch fetch mappings from OCL: ${url}`);
      console.log(
        `Auth type: ${auth.type}, Total limit: ${limit}, Batch size: ${this.batchSize}`,
      );

      let allMappings: any = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allMappings.length < limit) {
        const batchLimit = Math.min(this.batchSize, limit - allMappings.length);

        console.log(
          `Fetching mappings batch: offset=${offset}, limit=${batchLimit}, total fetched=${allMappings.length}`,
        );

        const batchMappings = await this.fetchMappingsBatch(
          url,
          auth,
          offset,
          batchLimit,
        );

        if (batchMappings && batchMappings.length > 0) {
          allMappings = allMappings.concat(batchMappings);
          offset += batchMappings.length;

          // Check if we got fewer mappings than requested (end of data)
          if (batchMappings.length < batchLimit) {
            hasMore = false;
          }

          // Add delay between batches to avoid rate limiting
          if (hasMore && allMappings.length < limit) {
            await this.delay(this.delayBetweenBatches);
          }
        } else {
          hasMore = false;
        }
      }

      console.log(
        `Successfully fetched ${allMappings.length} mappings from OCL in batches`,
      );
      return allMappings;
    } catch (error: any) {
      console.error("Error fetching mappings from OCL:", error.message);
      if (error.response) {
        console.error("OCL Response status:", error.response.status);
        console.error("OCL Response data:", error.response.data);
      }
      throw new Error(`Failed to fetch mappings from OCL: ${error.message}`);
    }
  }

  /**
   * Fetch a single batch of concepts
   * @param {string} url - Base URL for the concepts endpoint
   * @param {Object} auth - Authentication object
   * @param {number} offset - Offset for pagination
   * @param {number} limit - Number of concepts to fetch in this batch
   * @returns {Promise<Array>} Array of concepts for this batch
   */
  async fetchBatch(url: string, auth: any, offset: number, limit: number) {
    try {
      // Build query parameters
      const params = {
        limit: limit,
        offset: offset,
        verbose: true,
      };

      // Build headers
      const headers: any = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      // Add authentication headers
      if (auth.type === "token" && auth.token) {
        headers["Authorization"] = `Token ${auth.token}`;
      } else if (auth.type === "basic" && auth.username && auth.password) {
        const credentials = Buffer.from(
          `${auth.username}:${auth.password}`,
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }

      const response = await axios.get(url, {
        params: params,
        headers: headers,
        timeout: 30000, // 30 second timeout
      });

      return response.data || [];
    } catch (error: any) {
      console.error(
        `Error fetching batch (offset=${offset}, limit=${limit}):`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Fetch a single batch of mappings
   * @param {string} url - Base URL for the mappings endpoint
   * @param {Object} auth - Authentication object
   * @param {number} offset - Offset for pagination
   * @param {number} limit - Number of mappings to fetch in this batch
   * @returns {Promise<Array>} Array of mappings for this batch
   */
  async fetchMappingsBatch(
    url: string,
    auth: any,
    offset: number,
    limit: number,
  ) {
    try {
      // Build query parameters
      const params = {
        limit: limit,
        offset: offset,
        verbose: true,
      };

      // Build headers
      const headers: any = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      // Add authentication headers
      if (auth.type === "token" && auth.token) {
        headers["Authorization"] = `Token ${auth.token}`;
      } else if (auth.type === "basic" && auth.username && auth.password) {
        const credentials = Buffer.from(
          `${auth.username}:${auth.password}`,
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }

      const response = await axios.get(url, {
        params: params,
        headers: headers,
        timeout: 30000, // 30 second timeout
      });

      return response.data || [];
    } catch (error: any) {
      console.error(
        `Error fetching mappings batch (offset=${offset}, limit=${limit}):`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Utility function to add delay between batch requests
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after the delay
   */
  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { OCLService };
