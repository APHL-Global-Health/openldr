import fs from 'fs';
import archiver from 'archiver';

const numMessages = 5; // Default number of messages for testing

const DEFAULT_MANUAL_ENTRY = {
    firstName: "Zach",
    lastName: "Finn",
    dob: "2025-07-01",
    sex: "Male",
    patientId: "test_1111",
    specimenDate: "2025-07-01",
    orderProvider: "Bob",
    labFacilityCode: "ZLB",
    requestId: "1234567890",
    panelCode: "ZLB_PARASITE_COUNT",
    panelDescription: "Parasite Count",
    observationCode: "PLASMODIUM_FALCIPARUM_COUNT",
    observationDescription: "Plasmodium falciparum Count",
    interpretation: "High",
    results: "33",
    resultUnits: "copies/mL",
    referenceRange: "1-44"
};

const HIV_VIRAL_LOAD = {
    firstName: "Sarah",
    lastName: "Johnson",
    dob: "1990-05-15",
    sex: "Female",
    patientId: "P12345",
    specimenDate: "2024-07-03",
    orderProvider: "Dr. Robert Smith",
    labFacilityCode: "ZLB",
    requestId: "HIV_VL_20240703_001",
    panelCode: "HIV_VL",
    panelDescription: "HIV Viral Load",
    observationCode: "HIV_RNA_QUANT",
    observationDescription: "HIV-1 RNA Quantitative",
    interpretation: "Undetectable",
    results: "150",
    resultUnits: "copies/mL",
    referenceRange: "< 200"
};

const MALARIA_RAPID = {
    firstName: "Michael",
    lastName: "Okello",
    dob: "1985-12-20",
    sex: "Male",
    patientId: "P67890",
    specimenDate: "2024-07-03",
    orderProvider: "Dr. Jane Smith",
    labFacilityCode: "ZLB",
    requestId: "MALARIA_20240703_001",
    panelCode: "MALARIA_RAPID",
    panelDescription: "Malaria Rapid Diagnostic Test",
    observationCode: "PLASMODIUM_FALCIPARUM_RAPID",
    observationDescription: "Plasmodium falciparum Rapid Test",
    interpretation: "Positive",
    results: "POSITIVE",
    resultUnits: null,
    referenceRange: "NEGATIVE"
};

const TB_PCR = {
    firstName: "Jane",
    lastName: "Smith",
    dob: "1978-08-10",
    sex: "Female",
    patientId: "P13579",
    specimenDate: "2024-07-03",
    orderProvider: "Dr. Michael Brown",
    labFacilityCode: "ZLB",
    requestId: "TB_PCR_20240703_001",
    panelCode: "TB_PCR",
    panelDescription: "Tuberculosis PCR Test",
    observationCode: "MYCOBACTERIUM_TB_PCR",
    observationDescription: "Mycobacterium tuberculosis PCR",
    interpretation: "Negative",
    results: "NEGATIVE",
    resultUnits: null,
    referenceRange: "NEGATIVE"
};

const entryData = [
    DEFAULT_MANUAL_ENTRY, 
    HIV_VIRAL_LOAD, 
    MALARIA_RAPID, 
    TB_PCR
];

let jsonData = [];

for (let i = 1; i <= numMessages; i++) {
    const typeIndex = (i - 1) % 4;
    jsonData.push(JSON.stringify(entryData[typeIndex]));
}

try {
  fs.writeFileSync('sample.data.jsonl', jsonData.join("\n"), 'utf8');
  console.log('File written successfully.');

  // Create a zip file
  const output = fs.createWriteStream('sample.data.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  // Listen for archive events
  output.on('close', () => {
    console.log(`Zip created successfully: ${archive.pointer()} bytes`);
  });
  
  archive.on('error', (err) => {
    throw err;
  });
  
  // Pipe archive data to the file
  archive.pipe(output);
  
  // Add the JSONL file to the zip
  archive.file('sample.data.jsonl', { name: 'sample.data.jsonl' });
  
  // Finalize the archive
  await archive.finalize();
} catch (err) {
  console.error('Error writing file:', err);
}