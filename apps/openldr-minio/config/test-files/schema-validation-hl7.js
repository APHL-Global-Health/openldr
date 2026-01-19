// OpenLDRv2 Schema Validation Plugin
// Converts HL7 messages to match OpenLDRv2_Fields.sql schema

// Helper functions for date formatting
const formatDateTime = (hl7DateTime) => {
  if (!hl7DateTime) return null;
  // Convert HL7 datetime (YYYYMMDDHHMMSS) to ISO format
  const year = hl7DateTime.substring(0, 4);
  const month = hl7DateTime.substring(4, 6);
  const day = hl7DateTime.substring(6, 8);
  const hour = hl7DateTime.substring(8, 10);
  const minute = hl7DateTime.substring(10, 12);
  const second = hl7DateTime.substring(12, 14);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const formatDate = (hl7Date) => {
  if (!hl7Date) return null;
  // Convert HL7 date (YYYYMMDD) to ISO format
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  return `${year}-${month}-${day}`;
};

// Helper function to calculate age in years
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const birth = new Date(formatDate(birthDate));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
  }
  return age;
};

// Helper function to calculate age in days
const calculateAgeInDays = (birthDate) => {
  if (!birthDate) return null;
  const birth = new Date(formatDate(birthDate));
  const today = new Date();
  const diffTime = Math.abs(today - birth);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Simple HL7 Parser - self-contained in plugin
class HL7Message {
  constructor(message) {
    // Handle both \r\n, \r, and \n line endings
    this.segments = message.split(/\r\n|\r|\n/).map(line => line.split('|')).filter(seg => seg.length > 1);
  }
  
  getSegment(type) {
    const segment = this.segments.find(seg => seg[0] === type);
    return segment ? {
      getField: (index) => segment[index] || ''
    } : null;
  }
  
  getSegments(type) {
    return this.segments
      .filter(seg => seg[0] === type)
      .map(segment => ({
        getField: (index) => segment[index] || ''
      }));
  }
}

const validate = (message) => {
  try {
    const hl7Message = new HL7Message(message);
    // Validate required segments
    const requiredSegments = ['MSH', 'PID', 'OBR'];
    for (const segment of requiredSegments) {
      if (!hl7Message.getSegment(segment)) {
        throw new Error(`Missing required segment: ${segment}`);
      }
    }
    // Validate MSH segment
    const msh = hl7Message.getSegment('MSH');
    if (!msh.getField(3) || !msh.getField(4) || !msh.getField(9)) {
      throw new Error('MSH segment missing required fields');
    }
    // Validate PID segment
    const pid = hl7Message.getSegment('PID');
    if (!pid.getField(3) || !pid.getField(5) || !pid.getField(7)) {
      throw new Error('PID segment missing required fields');
    }
    // Validate OBR segment
    const obr = hl7Message.getSegment('OBR');
    if (!obr.getField(2) || !obr.getField(4)) {
      throw new Error('OBR segment missing required fields');
    }
    // Validate OBX segments
    const obxSegments = hl7Message.getSegments('OBX');
    if (obxSegments.length === 0) {
      throw new Error('No OBX segments found');
    }
    for (const obx of obxSegments) {
      if (!obx.getField(3) || !obx.getField(5)) {
        throw new Error('OBX segment missing required fields');
      }
    }
    return true;
  } catch (error) {
    throw new Error(`Validation failed: ${error.message}`);
  }
};

const convert = (message) => {
  const hl7Message = new HL7Message(message);
  // Extract message header info
  const msh = hl7Message.getSegment('MSH');
  const pid = hl7Message.getSegment('PID');
  const obr = hl7Message.getSegment('OBR');
  const obxSegments = hl7Message.getSegments('OBX');

  // Calculate ages from DOB
  const dob = pid.getField(7);
  const ageInYears = dob ? calculateAge(dob) : null;
  const ageInDays = dob ? calculateAgeInDays(dob) : null;

  // Requests table fields
  const requests = {
    DateTimeStamp: formatDateTime(msh.getField(7)),
    Versionstamp: msh.getField(12) || '1.0.0',
    LIMSDateTimeStamp: formatDateTime(msh.getField(7)),
    LIMSVersionstamp: msh.getField(12) || '1.0.0',
    RequestID: obr.getField(2),
    OBRSetID: parseInt(obr.getField(1)) || 1,
    PanelCode: obr.getField(4) ? obr.getField(4).split('^')[0] : '',
    PanelDesc: obr.getField(4) ? obr.getField(4).split('^')[1] || '' : '',
    SpecimenDateTime: formatDateTime(obr.getField(7)),
    RegisteredDateTime: formatDateTime(obr.getField(7)),
    ReceivedDateTime: formatDateTime(obr.getField(7)),
    AnalysisDateTime: formatDateTime(obr.getField(7)),
    AuthorisedDateTime: null,
    PointOfCare: obr.getField(16) || '',
    RegisteredBy: obr.getField(16) || '',
    TestedBy: '',
    AuthorisedBy: obr.getField(16) || '',
    AgeInYears: ageInYears,
    AgeInDays: ageInDays,
    RejectionCode: '',
    RequestingLabCode: msh.getField(3),
    TestingLabCode: msh.getField(4),
    SpecimenSourceCode: obr.getField(15) ? obr.getField(15).split('^')[0] : '',
    SpecimenSourceDesc: obr.getField(15) ? obr.getField(15).split('^')[1] || '' : '',
    SexCode: pid.getField(8) || ''
  };

  // Lab results table fields - convert all OBX segments
  const labresults = obxSegments.map(obx => ({
    DateTimeStamp: formatDateTime(msh.getField(7)),
    Versionstamp: msh.getField(12) || '1.0.0',
    LIMSDateTimeStamp: formatDateTime(msh.getField(7)),
    LIMSVersionStamp: msh.getField(12) || '1.0.0',
    RequestID: obr.getField(2),
    OBRSetID: parseInt(obr.getField(1)) || 1,
    OBXSetID: parseInt(obx.getField(1)) || 1,
    OBXSubID: parseInt(obx.getField(4)) || 0,
    ObservationCode: obx.getField(3) ? obx.getField(3).split('^')[0] : '',
    ObservationDesc: obx.getField(3) ? obx.getField(3).split('^')[1] || '' : '',
    RptResult: obx.getField(5) || '',
    RptUnits: obx.getField(6) || '',
    CodedValue: obx.getField(5) || ''
  }));

  return { requests, labresults };
};

module.exports = {
  validate,
  convert
}; 