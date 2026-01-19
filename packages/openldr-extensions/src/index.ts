import * as extensionLoader from "./runtime/extensionLoader";
import * as versionManager from "./runtime/versionManager";

import * as api from "./sdk/api";
import * as commandRegistry from "./sdk/commandRegistry";
import * as eventEmitter from "./sdk/eventEmitter";
import * as permissionManager from "./sdk/permissionManager";
import * as secureAPI from "./sdk/secureAPI";
import * as storage from "./sdk/storage";
import * as uiRegistry from "./sdk/uiRegistry";

import * as types from "./types";

const runtime: any = {
  extensionLoader,
  versionManager,
};

const sdk: any = {
  api,
  commandRegistry,
  eventEmitter,
  permissionManager,
  secureAPI,
  storage,
  uiRegistry,
};

export { sdk, runtime, types };
