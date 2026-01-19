/* eslint-disable react-refresh/only-export-components */
import axios, { AxiosInstance } from "axios";
import React from "react";
// import * as utils from "@repo/openldr-core/lib/utils";
// import { jwtDecode } from "jwt-decode";

// import DynamicPluginManager from "@/lib/DynamicPluginManager";
// import { customPlugin } from "@/plugins/custom-plugin";
// import { weatherPlugin } from "@/plugins/weather-plugin";
// import { textProcessorPlugin } from "@/plugins/text-processor";
// import {
//   SidebarComponent,
//   MenuItem,
//   PluginSettings,
//   PluginState,
// } from "@/types/plugins";

const {
  VITE_API_DB_URL: apiUrl,
  VITE_TEST_ONLY: testing,
  VITE_API_VERSION: version,
} = import.meta.env;

export type User = {
  id: string;
  username: string;
  email: string;
  roles: string[];
  token: string | undefined | null;
};

const returntype = "json";

export type QueryType = {
  "content-type"?: string;
  "x-limit"?: number;
  "x-page"?: number;
  "x-query"?: string;
  "x-sort"?: string;
  "x-project"?: string;
  Authorization?: string;
};

export class OpenLDRClient {
  #mountCount: number;
  #user: User | undefined | null;
  #api: AxiosInstance;
  // #pluginManager: PluginManager;
  // #pluginState: PluginState | undefined | null;

  constructor() {
    this.#mountCount = 0;
    this.#user = null;
    // this.#pluginState = {
    //   sidebarComponents: [],
    //   menuItems: [],
    //   pluginSettings: [],
    //   plugins: [],
    // };
    // this.#pluginManager = new PluginManager();

    this.#api = axios.create({
      baseURL: apiUrl,
      headers: { "Content-Type": "applicationpluginManager/json" },
      withCredentials: testing === undefined ? false : testing === "false",
    });
  }

  async #mount(): Promise<void> {
    // try {
    //   // Register plugins
    //   try {
    //     this.#pluginManager.registerPlugin(customPlugin);
    //     this.#pluginManager.registerPlugin(weatherPlugin);
    //     this.#pluginManager.registerPlugin(textProcessorPlugin);
    //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //   } catch (_error: any) {
    //     // console.error("Error registering plugins:", error);
    //   }
    //   // Load sidebar components
    //   const sidebarResults =
    //     this.#pluginManager.emitHook<SidebarComponent>("render-sidebar");
    //   const sortedSidebar = sidebarResults.sort(
    //     (a, b) => (a.order || 0) - (b.order || 0)
    //   );
    //   // Load menu items
    //   const menuResults = this.#pluginManager.emitHook<MenuItem>("menu-items");
    //   // Load plugin settings
    //   const settingsResults =
    //     this.#pluginManager.emitHook<PluginSettings>("plugin-settings");
    //   // Get registered plugins
    //   const plugins = this.#pluginManager.getPlugins();
    //   this.#pluginState = {
    //     sidebarComponents: sortedSidebar,
    //     menuItems: menuResults,
    //     pluginSettings: settingsResults,
    //     plugins,
    //   };
    // } catch (error) {
    //   console.error("Failed to initialize plugins:", error);
    // }
    // console.log("OpenLDR client mounted");
  }

  mount(): void {
    this.#mountCount++;
    if (this.#mountCount !== 1) return;

    this.#mount();
  }

  unmount(): void {
    this.#mountCount--;
    if (this.#mountCount !== 0) return;

    // console.log("OpenLDR client unmounted");
  }

  // get pluginManager(): PluginManager | undefined | null {
  //   return this.#pluginManager;
  // }

  // get pluginState(): PluginState | undefined | null {
  //   return this.#pluginState;
  // }

  setUser(user: User): void {
    this.#user = user;
  }

  get user(): User | undefined | null {
    return this.#user;
  }

  get api(): AxiosInstance {
    return this.#api;
  }

  // get decoded(): string | undefined | null {
  //   return this.#token ? jwtDecode(this.#token) : null;
  // }

  getTokens = async (username: string, password: string) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const response = await axios.post(
      `${apiUrl}/api/openldr/v${version}/token`,
      {
        username: username,
        password: password,
      },
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );

    const token = response.data.data.access_token;
    //   const decoded: any = jwt.decode(token, { complete: true });
    return token;
  };

  login = async (username: string, password: string) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const response = await this.#api.post(
      `${apiUrl}/api/openldr/v${version}/login`,
      {
        username: username,
        password: password,
      },
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );

    return response.data;
  };

  logout = async () => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const response = await this.#api.post(`/api/openldr/v${version}/logout`, {
      headers: {
        "content-type": "application/json",
      },
    });

    console.log(response);

    return response.data;
  };

  isAuthenticated = async () => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    try {
      const clientId = "openldr-client";

      const response = await this.#api.get(
        `/api/openldr/v${version}/authenticated/${clientId}`,
        {
          headers: {
            "content-type": "application/json",
          },
        }
      );
      return response.data;
    } catch (e) {
      console.log(e);
      return { authenticated: false };
    }

    return { authenticated: false };
  };

  refreshToken = async () => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const response = await this.#api.post(`/api/openldr/v${version}/refresh`, {
      headers: {
        "content-type": "application/json",
      },
    });
    return response.data;
  };

  getTables = async (token?: string) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const headers: QueryType = {
      "content-type": "application/json",
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const response = await this.#api.get(`/api/openldr/v${version}/tables`, {
      headers,
    });

    return response;
  };

  getTableSchema = async (name: string, schema: string, token?: string) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const headers: QueryType = {
      "content-type": "application/json",
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const response = await this.#api.get(
      `/api/openldr/v${version}/table/${schema}/${name}`,
      {
        headers,
      }
    );

    return response;
  };

  getTableData = async (
    name: string,
    schema: string,
    {
      limit: limit = 100,
      page: page = 1,
      query: query = [],
      sort: sort = {},
      project: project = {},
    }: {
      limit: number;
      page?: number;
      query?: object[];
      sort?: object;
      project?: object;
    },
    token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const options = {
      limit,
      page,
      query: JSON.stringify(query),
      sort: JSON.stringify(sort),
      project: JSON.stringify(project),
    };

    const headers: QueryType = {
      "content-type": "application/json",
      "x-limit": limit,
      "x-page": page,
      "x-query": JSON.stringify(query),
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const response = await this.#api.post(
      `/api/openldr/v${version}/table/data`,
      { schema, table: name, options },
      { headers }
    );

    return response;
  };

  getTableDataCount = async (
    {
      limit: limit = 100,
      page: page = 1,
      query: query = {},
    }: {
      limit: number;
      page?: number;
      query?: object;
    },
    token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const headers: QueryType = {
      "content-type": "application/json",
      "x-limit": limit,
      "x-page": page,
      "x-query": JSON.stringify(query),
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const schema = "openldr";
    const table = "requests";
    const options = {};

    const response = await this.#api.post(
      `/api/openldr/v${version}/table/data/count`,
      { schema, table, options },
      {
        headers,
      }
    );

    return response;
  };

  getData = async (
    {
      limit: limit = 100,
      page: page = 1,
      query: query = {},
      sort: sort = {},
      project: project = {},
    }: {
      limit: number;
      page?: number;
      query?: object;
      sort?: object;
      project?: object;
    },
    token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const headers: QueryType = {
      "content-type": "application/json",
      "x-limit": limit,
      "x-page": page,
      "x-query": JSON.stringify(query),
      "x-sort": JSON.stringify(sort),
      "x-project": JSON.stringify(project),
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const response = await this.#api.get(
      `/api/openldr/v${version}/json/requests`,
      {
        headers,
      }
    );

    return response;
  };

  postData = async (
    _doc: string,
    _data: object | [object],
    _token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    // await utils.validator(version, returntype, doc, data);

    // const headers: QueryType = {
    //   "content-type": "application/json",
    // };
    // if (!token) headers["Authorization"] = `token ${token}`;

    // const response = await this.#api.post(
    //   `/api/openldr/v${version}/${returntype}/${doc}`,
    //   data,
    //   { headers }
    // );

    // return response;
    return "";
  };

  updateData = async (
    _doc: string,
    _data: object | [object],
    _token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    // await utils.validator(version, returntype, doc, data);

    // const headers: QueryType = {
    //   "content-type": "application/json",
    // };
    // if (!token) headers["Authorization"] = `token ${token}`;

    // const response = await this.#api.put(
    //   `/api/openldr/v${version}/${returntype}/${doc}`,
    //   data,
    //   { headers }
    // );

    // return response;
    return "";
  };

  deleteData = async (
    doc: string,
    {
      query: query = {},
    }: {
      query?: object;
    },
    token?: string
  ) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");
    if (!query || Object.keys(query).length === 0)
      throw new Error("Query not found");

    const headers: QueryType = {
      "content-type": "application/json",
      "x-query": JSON.stringify(query),
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const response = await this.#api.delete(
      `/api/openldr/v${version}/${returntype}/${doc}`,
      { headers }
    );

    return response;
  };

  testData = async (token?: string) => {
    if (!apiUrl) throw new Error("API URL not found");
    if (!version) throw new Error("API Version not found");

    const headers: QueryType = {
      "content-type": "application/json",
    };
    if (!token) headers["Authorization"] = `token ${token}`;

    const data = {
      DateTimeStamp: "2021-01-11 15:03:12.616",
      Versionstamp: "1.0.0",
      LIMSDateTimeStamp: "2021-01-11 15:03:12.616",
      LIMSVersionstamp: "01.00.00.000",
      RequestID: "TZDISADOA0000001",
      OBRSetID: 1,
      LOINCPanelCode: "",
      LIMSPanelCode: "HIVVL",
      LIMSPanelDesc: "HIV VIRAL LOAD",
      HL7PriorityCode: "R",
      SpecimenDateTime: "2021-01-07 08:30:00.000",
      RegisteredDateTime: "2021-01-11 15:08:55.764",
      ReceivedDateTime: "2021-01-11 15:08:00.000",
      AnalysisDateTime: "2021-01-11 15:08:00.000",
      AuthorisedDateTime: null,
      AdmitAttendDateTime: null,
      CollectionVolume: 0.0,
      RequestingFacilityCode: "107625-6",
      ReceivingFacilityCode: "105299-2",
      LIMSPointOfCareDesc: "107625-6",
      RequestTypeCode: "",
      ICD10ClinicalInfoCodes: "",
      ClinicalInfo: "",
      HL7SpecimenSourceCode: "",
      LIMSSpecimenSourceCode: "PSM",
      LIMSSpecimenSourceDesc: "Plasma",
      HL7SpecimenSiteCode: "",
      LIMSSpecimenSiteCode: "",
      LIMSSpecimenSiteDesc: "",
      WorkUnits: 0.0,
      CostUnits: 0.0,
      HL7SectionCode: "",
      HL7ResultStatusCode: "",
      RegisteredBy: "George Michael",
      TestedBy: "",
      AuthorisedBy: "Michael Laizer",
      OrderingNotes: "107625621020006",
      EncryptedPatientID: "04020105001119",
      AgeInYears: 33,
      AgeInDays: 12196,
      HL7SexCode: "F",
      HL7EthnicGroupCode: "",
      Deceased: false,
      Newborn: false,
      HL7PatientClassCode: "",
      AttendingDoctor: "Dr Doom",
      TestingFacilityCode: "105299-2",
      ReferringRequestID: "MOR107625621020006",
      Therapy: "",
      LIMSAnalyzerCode: "",
      TargetTimeDays: 0,
      TargetTimeMins: 0,
      LIMSRejectionCode: "MLTRJ",
      LIMSRejectionDesc: "Multiple Rejections",
      LIMSFacilityCode: "107625-6",
      Repeated: 0,
      Results: [
        {
          DateTimeStamp: "2021-01-11 15:03:12",
          Versionstamp: "1.0.0",
          LIMSDateTimeStamp: "2021-01-11 15:03:12",
          LIMSVersionStamp: "01.00.00.000",
          RequestID: "TZDISADOA0000001",
          OBRSetID: 1,
          OBXSetID: 3,
          OBXSubID: 0,
          LOINCCode: "",
          HL7ResultTypeCode: "",
          SIValue: 0.0,
          SIUnits: "",
          SILoRange: 0.0,
          SIHiRange: 0.0,
          HL7AbnormalFlagCodes: "",
          ResultSemiquantitive: 0,
          Note: false,
          LIMSObservationCode: "WFN",
          LIMSObservationDesc: "Wrong facility name",
          LIMSRptResult: "Rejection",
          LIMSRptUnits: "",
          LIMSRptFlag: "",
          LIMSRptRange: "",
          LIMSCodedValue: "",
          WorkUnits: 0.0,
          CostUnits: 0.0,
        },
        {
          DateTimeStamp: "2021-01-11 15:03:12",
          Versionstamp: "1.0.0",
          LIMSDateTimeStamp: "2021-01-11 15:03:12",
          LIMSVersionStamp: "01.00.00.000",
          RequestID: "TZDISADOA0000001",
          OBRSetID: 1,
          OBXSetID: 4,
          OBXSubID: 0,
          LOINCCode: "",
          HL7ResultTypeCode: "",
          SIValue: 0.0,
          SIUnits: "",
          SILoRange: 0.0,
          SIHiRange: 0.0,
          HL7AbnormalFlagCodes: "",
          ResultSemiquantitive: 0,
          Note: false,
          LIMSObservationCode: "WFN",
          LIMSObservationDesc: "Wrong facility name",
          LIMSRptResult: "Rejection",
          LIMSRptUnits: "",
          LIMSRptFlag: "",
          LIMSRptRange: "",
          LIMSCodedValue: "",
          WorkUnits: 0.0,
          CostUnits: 0.0,
        },
      ],
    };

    const response = await this.#api.post(
      `/api/openldr/v${version}/${returntype}/requests`,
      data,
      { headers }
    );

    return response;
  };
}

export const OpenLDRClientContext = React.createContext<
  OpenLDRClient | undefined
>(undefined);

export const useOpenLDRClient = (queryClient?: OpenLDRClient) => {
  const client = React.useContext(OpenLDRClientContext);

  if (queryClient) {
    return queryClient;
  }

  if (!client) {
    throw new Error("No SQLiteClient set, use SQLiteClientProvider to set one");
  }

  return client;
};

export type OpenLDRClientProviderProps = {
  client: OpenLDRClient;
  children?: React.ReactNode;
};

export const OpenLDRClientProvider = ({
  client,
  children,
}: OpenLDRClientProviderProps): React.JSX.Element => {
  React.useEffect(() => {
    client.mount();

    const requestInterceptor = client.api.interceptors.request.use(
      async (config) => {
        if (
          !config.headers["Authorization"] &&
          client.user &&
          client.user.token
        ) {
          config.headers["Authorization"] = `Bearer ${client.user.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = client.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const message = error?.response?.data.data;
        if (["No refresh token", "Failed to get token"].includes(message)) {
          return Promise.reject(error);
        }

        const prevRequest = error?.config;
        if (error?.response?.status === 400 && !prevRequest?.sent) {
          prevRequest.sent = true;
          window.location.href = "/";
          return Promise.reject(new Error("Refresh token expired"));
        } else if (error?.response?.status === 401 && !prevRequest?.sent) {
          try {
            prevRequest.sent = true;
            const accessToken = (await client.refreshToken()).data;
            prevRequest.headers["Authorization"] = `Bearer ${accessToken}`;
            return client.api(prevRequest);
          } catch {
            return Promise.reject(new Error("Refresh token failed"));
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      client.unmount();

      client.api.interceptors.request.eject(requestInterceptor);
      client.api.interceptors.response.eject(responseInterceptor);
    };
  }, [client]);

  return (
    <OpenLDRClientContext.Provider value={client}>
      {children}
    </OpenLDRClientContext.Provider>
  );
};
