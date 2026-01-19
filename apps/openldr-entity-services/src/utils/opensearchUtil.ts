import { Client } from "@opensearch-project/opensearch";

const client = new Client({
  node: "http://openldr-opensearch:9200", // Replace with your OpenSearch endpoint
  // auth: {
  //   username: 'your-username', // Replace with your credentials
  //   password: 'your-password',
  // },
  ssl: {
    rejectUnauthorized: false, // Use true in production with proper certificates
  },
});

export async function getUniqueDataFeedsProjectsUseCases(index: any) {
  const query = {
    index: index,
    body: {
      query: {
        match_all: {},
      },
      aggs: {
        by_usecase: {
          terms: {
            field: `Records.s3.object.userMetadata.X-Amz-Meta-Usecase.keyword`,
            size: 10000,
          },
        },
        by_senders: {
          terms: {
            field: "Records.s3.object.userMetadata.X-Amz-Meta-Senders.keyword",
            size: 10000,
          },
        },
        by_project: {
          terms: {
            field: "Records.s3.object.userMetadata.X-Amz-Meta-Project.keyword",
            size: 10000,
          },
        },
      },
      size: 0,
    },
  };

  const response = await client.search(query);
  // const aggregations = response.body.aggregations;
  // const total = response.body.hits.total.value;
  const dataFeeds = (response.body as any).aggregations.by_senders.buckets;
  const projects = (response.body as any).aggregations.by_project.buckets;
  const useCases = (response.body as any).aggregations.by_usecase.buckets;

  return { dataFeeds, projects, useCases };
}

export async function getIndexDocumentCounts() {
  try {
    const response: any = await (client.cat as any).indices({
      index: "raw-inbound,validated-inbound,mapped-inbound,processed-inbound",
      format: "json",
      h: "index,docs.count",
    });

    const result: any = {
      "raw-inbound": 0,
      "validated-inbound": 0,
      "mapped-inbound": 0,
      "processed-inbound": 0,
    };

    response.body.forEach(
      ({
        index,
        "docs.count": docCount,
      }: {
        index: string;
        "docs.count": string;
      }) => {
        if (result.hasOwnProperty(index)) {
          result[index] = parseInt(docCount || "0", 10);
        }
      }
    );

    return result;
  } catch (error) {
    console.error("Error fetching document counts:", error);
    return {
      "raw-inbound": 0,
      "validated-inbound": 0,
      "mapped-inbound": 0,
      "processed-inbound": 0,
    };
  }
}

export async function getMessageCountsByInterval() {
  const query: any = {
    index: "processed-inbound",
    body: {
      query: {
        bool: {
          filter: [
            {
              range: {
                "Records.eventTime": {
                  gte: "now/d",
                  lte: "now+1d/d-1s",
                  time_zone: "+02:00",
                },
              },
            },
          ],
        },
      },
      aggs: {
        by_time: {
          date_histogram: {
            field: "Records.eventTime",
            fixed_interval: "10m",
            min_doc_count: 0,
            time_zone: "+02:00",
            extended_bounds: {
              min: "now/d",
              max: "now+1d/d-1s",
            },
          },
        },
      },
      size: 0,
    },
  };

  try {
    const response = await client.search(query);
    const buckets = (response.body as any).aggregations.by_time.buckets;
    const result = buckets.map((bucket: any) => ({
      time: bucket.key_as_string,
      count: bucket.doc_count,
    }));
    return result;
  } catch (error) {
    console.error("Error fetching message counts:", error);
    return [];
  }
}

export async function getLatestMessages() {
  const query: any = {
    index: "processed-inbound",
    body: {
      query: {
        match_all: {},
      },
      sort: [
        {
          "Records.eventTime": {
            order: "desc",
          },
        },
      ],
      size: 5,
    },
  };

  try {
    const response = await client.search(query);
    const results = response.body.hits.hits;
    const messages = results.map((result: any) => {
      return result._source.Records[0].s3.object.userMetadata;
    });

    return messages;
  } catch (error) {
    console.error("Error fetching message counts:", error);
    return [];
  }
}
