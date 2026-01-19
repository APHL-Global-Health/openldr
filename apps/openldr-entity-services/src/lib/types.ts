export interface UserParams {
  userId?: string | undefined;
  username?: string | undefined;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role?: string | undefined;
  facilityId?: string | undefined;
  temporaryPassword?: string | undefined;
}

export interface FacilityParams {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  facilityType: string;
  description?: string;
  countryCode: string;
  provinceCode: string;
  regionCode: string;
  districtCode: string;
  subDistrictCode: string;
  lattLong?: string;
}

export interface DataFeedParams {
  dataFeedId: string;
  dataFeedName: string;
  facilityId: string;
  schemaPluginId: string | null;
  mapperPluginId: string | null;
  recipientPluginId: string | null;
  projectId: string;
  useCaseId: string;
  isEnabled: boolean;
  isProtected?: boolean;
}

export interface ProjectParams {
  projectId: string;
  projectName: string;
  description?: any;
  isEnabled?: any;
}

export interface UseCaseParams {
  useCaseId: string;
  useCaseName: string;
  description: string;
  isEnabled: boolean;
}
