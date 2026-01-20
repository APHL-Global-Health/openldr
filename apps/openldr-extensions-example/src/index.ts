// Declare the runtime globals (these exist at runtime from window)
const _window_ = window as any;
const sdk = _window_.__OPENLDR_SDK__;
const exts = sdk.extensions;
const types = exts.types;

const React = sdk.react;

import { Cable } from "lucide-react";
import "@andypf/json-viewer";

const MyExtension: typeof types.Extension = {
  id: "org.openldr.extension.example.fakelis",
  name: "FakeLis Extension",
  version: "1.0.0",
  link: "org.openldr.extension.example.fakeliss",
  icon: {
    menu: Cable,
    package:
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNCcgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSdub25lJyBzdHJva2U9JyMzQjgyRjYnIHN0cm9rZS13aWR0aD0nMicgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJyBzdHJva2UtbGluZWpvaW49J3JvdW5kJyBjbGFzcz0nbHVjaWRlIGx1Y2lkZS1jYWJsZS1pY29uIGx1Y2lkZS1jYWJsZSc+PHBhdGggZD0nTTE3IDE5YTEgMSAwIDAgMS0xLTF2LTJhMiAyIDAgMCAxIDItMmgyYTIgMiAwIDAgMSAyIDJ2MmExIDEgMCAwIDEtMSAxeicvPjxwYXRoIGQ9J00xNyAyMXYtMicvPjxwYXRoIGQ9J00xOSAxNFY2LjVhMSAxIDAgMCAwLTcgMHYxMWExIDEgMCAwIDEtNyAwVjEwJy8+PHBhdGggZD0nTTIxIDIxdi0yJy8+PHBhdGggZD0nTTMgNVYzJy8+PHBhdGggZD0nTTQgMTBhMiAyIDAgMCAxLTItMlY2YTEgMSAwIDAgMSAxLTFoNGExIDEgMCAwIDEgMSAxdjJhMiAyIDAgMCAxLTIgMnonLz48cGF0aCBkPSdNNyA1VjMnLz48L3N2Zz4=",
  },

  activate: async (context: typeof types.ExtensionContext) => {
    // console.log("My extension is activating!");

    // Register a command
    const commandId = "myExtension.helloWorld";
    const disposable = exts.sdk.api.commands.registerCommand(commandId, () => {
      console.log("Hello from my extension!");
    });
    context.subscriptions.push(disposable);

    const fakeResponse = () => {
      return {
        Status: "successful",
        Data: [
          {
            LabNumber: "FAKE0138895",
            InnerLabNumber: "2019017",
            ReferenceNumber: null,
            NID: null,
            Facility: {
              Code: "HHAAL",
              FacilityName: "Katumbi",
              Region: "110853-9",
              District: "Dispensary",
              PostalAddress: "Uvinza",
              Street: "Kigoma",
            },
            WardClinic: null,
            FolderNo: "2019/017",
            LastName: "HAMISI",
            MiddleName: null,
            FirstName: "ALBENTINA",
            Sex: "F",
            Address: null,
            Therapy: null,
            Notes: null,
            ClinicalDiagnosis: "DD",
            Specimen: "PUSR",
            Condition: null,
            TakenDateTime: "2018-12-26T00:00:00.000Z",
            TakenBy: "REUBEN MASALU",
            CollectedDateTime: null,
            CollectedBy: "AGUSTINO",
            ReceivedInLabDateTime: "2019-01-06T21:08:10.000Z",
            ReceivedInLabBy: "Salum Nyanga",
            Priority: "R",
            DoctorCode: null,
            Doctor: null,
            Receipt: null,
            Amount: null,
            PaidBy: null,
            DobAge: null,
            TestOrders: [
              {
                DATESTAMP: "2015-04-13T15:15:15.703Z",
                CODE: "MRCSW",
                DESCRIPTION: "MICROBIOLOGY : RECTAL SWAB",
                ABBREV: "RECTAL SWA",
                SECTION: "M",
                PARAMETERS: [
                  "WETP",
                  "WWBC",
                  "WERY",
                  "MUCUS",
                  "OVA",
                  "OVA",
                  "CYSTS",
                  "CYSTS",
                  "PARAS",
                  "PARAS",
                  "LINE0",
                  "GRAMS",
                  "GRWC",
                  "STGRN",
                  "BACT",
                  "BACT",
                  "BACT",
                  "BACT",
                  "LINE0",
                  "MZNS",
                  "OOCYS",
                  "LINE0",
                  "SCULT",
                  "ORGS",
                  "ORGSV",
                  "ORGSW",
                  "ORGSX",
                  "ORGSY",
                  "EEC",
                  "REM",
                  "REM",
                  "REM",
                ],
                _CODE: "MRCSW",
                _DESCRIPTION: "MICROBIOLOGY : RECTAL SWAB",
                _ABBREVIATION: "RECTAL SWA",
                _WORKAREA_GROUP: " ",
              },
              {
                DATESTAMP: "2018-11-09T19:32:47.257Z",
                CODE: "MSENS",
                DESCRIPTION: "Microbiology Sensitivity",
                ABBREV: "",
                SECTION: "M",
                PARAMETERS: [
                  "ORGS",
                  "ORGSV",
                  "ORGS",
                  "ORGSV",
                  "ORGS",
                  "AMC",
                  "AMIK",
                  "AMP",
                  "AUGUM",
                  "AZYT",
                  "CARBE",
                  "CEF",
                  "CEFAZ",
                  "CEFEP",
                  "CEFOX",
                  "CEFTA",
                  "CEFUR",
                  "CEPHA",
                  "CHLOR",
                  "CIPRO",
                  "CLIND",
                  "COTRI",
                  "CTX",
                  "DOXY",
                  "ERYTH",
                  "GENTA",
                  "IMIP",
                  "MEM",
                  "MET",
                  "NALID",
                  "NITRO",
                  "NORF",
                  "OXACI",
                  "PIPER",
                  "SXT",
                  "TETRA",
                  "TOBRA",
                  "VANCO",
                  "PEN",
                ],
                _CODE: "MSENS",
                _DESCRIPTION: "Microbiology Sensitivity",
                _ABBREVIATION: "<",
                _WORKAREA_GROUP: " ",
              },
              {
                DATESTAMP: "2016-11-21T12:01:22.767Z",
                CODE: "MICBM",
                DESCRIPTION: "Micro Biochemical Tests",
                ABBREV: "",
                SECTION: "     ",
                PARAMETERS: [
                  "OXID",
                  "COAG",
                  "INDOL",
                  "CATAL",
                  "BACIT",
                  "OPTOC",
                  "PYR",
                  "BETLA",
                  "UREAS",
                  "SATEL",
                  "CAMPT",
                  "BILES",
                  "XVDIS",
                  "BILSO",
                  "CITRA",
                  "STRI",
                  "ESBL",
                  "MRSA",
                  "MCOM",
                  "MCOM",
                  "MCOM",
                  "MCOM",
                  "MTXT",
                  "MTXT",
                  "MTXT",
                  "MTXT",
                ],
                _CODE: "MICBM",
                _DESCRIPTION: "Micro Biochemical Tests",
                _ABBREVIATION: "",
                _WORKAREA_GROUP: " ",
              },
            ],
            RegisteredDatetime: "2019-01-07T08:22:23.000Z",
            TestResults: [
              {
                DATESTAMP: "2019-01-09T09:13:58.257Z",
                LABNO: "FAKE0138895",
                TESTCODE: "MICBM",
                TESTINDEX: 3,
                ORDER: {
                  CODE: "MICBM",
                  ORDERS: [
                    {
                      Type: 3,
                      Code: "OXID",
                      Value: "POS",
                      ResultType: 3,
                      Description: "Oxidase",
                      IsResulted: true,
                    },
                    {
                      Type: 3,
                      Code: "COAG",
                      Value: "",
                      ResultType: 3,
                      Description: "Coagulase",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "INDOL",
                      Value: "POS",
                      ResultType: 3,
                      Description: "Indole",
                      IsResulted: true,
                    },
                    {
                      Type: 3,
                      Code: "CATAL",
                      Value: "",
                      ResultType: 3,
                      Description: "Catalase",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BACIT",
                      Value: "",
                      ResultType: 3,
                      Description: "Bacitracin",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "OPTOC",
                      Value: "",
                      ResultType: 3,
                      Description: "Optochin",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "PYR",
                      Value: "",
                      ResultType: 3,
                      Description: "PYR",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BETLA",
                      Value: "",
                      ResultType: 3,
                      Description: "Beta Lactamase",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "UREAS",
                      Value: "",
                      ResultType: 3,
                      Description: "Urease",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "SATEL",
                      Value: "",
                      ResultType: 3,
                      Description: "Satellitism",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "CAMPT",
                      Value: "",
                      ResultType: 3,
                      Description: "CAMP Test",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BILES",
                      Value: "",
                      ResultType: 3,
                      Description: "Bile Esculin",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "XVDIS",
                      Value: "",
                      ResultType: 3,
                      Description: "XV Disc",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BILSO",
                      Value: "",
                      ResultType: 3,
                      Description: "Bile Solubility",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "CITRA",
                      Value: "",
                      ResultType: 3,
                      Description: "Citrate utilization",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "STRI",
                      Value: "POS",
                      ResultType: 3,
                      Description: "String Test",
                      IsResulted: true,
                    },
                    {
                      Type: 3,
                      Code: "ESBL",
                      Value: "",
                      ResultType: 3,
                      Description: "ESBL",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MRSA",
                      Value: "",
                      ResultType: 3,
                      Description: "MRSA Screening",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MCOM",
                      Value: "",
                      ResultType: 3,
                      Description: "ment",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MCOM",
                      Value: "",
                      ResultType: 3,
                      Description: "ment",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MCOM",
                      Value: "",
                      ResultType: 3,
                      Description: "ment",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MCOM",
                      Value: "",
                      ResultType: 3,
                      Description: "ment",
                      IsResulted: false,
                    },
                    {
                      Type: 5,
                      Code: "MTXT",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                    {
                      Type: 5,
                      Code: "MTXT",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                    {
                      Type: 5,
                      Code: "MTXT",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                    {
                      Type: 5,
                      Code: "MTXT",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                  ],
                },
              },
              {
                DATESTAMP: "2019-01-09T09:13:58.257Z",
                LABNO: "FAKE0138895",
                TESTCODE: "MRCSW",
                TESTINDEX: 1,
                ORDER: {
                  CODE: "MRCSW",
                  ORDERS: [
                    {
                      Type: 9,
                      Code: "WETP",
                      Value: "",
                      ResultType: 9,
                      Description: " Prep for Ova, Cysts, Para",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "WWBC",
                      Value: "",
                      ResultType: 3,
                      Description: "White Blood cells",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "WERY",
                      Value: "",
                      ResultType: 3,
                      Description: "Red Blood Cells",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "MUCUS",
                      Value: "",
                      ResultType: 3,
                      Description: "us Threads",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "OVA",
                      Value: "",
                      ResultType: 3,
                      Description: "Ova",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "OVA",
                      Value: "",
                      ResultType: 3,
                      Description: "Ova",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "CYSTS",
                      Value: "",
                      ResultType: 3,
                      Description: "ts",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "CYSTS",
                      Value: "",
                      ResultType: 3,
                      Description: "ts",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "PARAS",
                      Value: "",
                      ResultType: 3,
                      Description: "asites",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "PARAS",
                      Value: "",
                      ResultType: 3,
                      Description: "asites",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "LINE0",
                      Value: "",
                      ResultType: 9,
                      Description: "",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "GRAMS",
                      Value: "",
                      ResultType: 9,
                      Description: "GRAM STAIN",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "GRWC",
                      Value: "",
                      ResultType: 3,
                      Description: "White Blood cells",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "STGRN",
                      Value: "",
                      ResultType: 3,
                      Description: "m Negative Organisms seen",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BACT",
                      Value: "",
                      ResultType: 3,
                      Description: "0rganisms Seen",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BACT",
                      Value: "",
                      ResultType: 3,
                      Description: "0rganisms Seen",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BACT",
                      Value: "",
                      ResultType: 3,
                      Description: "0rganisms Seen",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "BACT",
                      Value: "",
                      ResultType: 3,
                      Description: "0rganisms Seen",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "LINE0",
                      Value: "",
                      ResultType: 9,
                      Description: "",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "MZNS",
                      Value: "",
                      ResultType: 9,
                      Description: "IFIED ZIELH-NEELSEN STAIN",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "OOCYS",
                      Value: "",
                      ResultType: 3,
                      Description: "ysts",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "LINE0",
                      Value: "",
                      ResultType: 9,
                      Description: "",
                      IsResulted: false,
                    },
                    {
                      Type: 9,
                      Code: "SCULT",
                      Value: "",
                      ResultType: 9,
                      Description: "TURE RESULT",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "ORGS",
                      Value: "VIBCO",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: true,
                    },
                    {
                      Type: 3,
                      Code: "ORGSV",
                      Value: "",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "ORGSW",
                      Value: "",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "ORGSX",
                      Value: "",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "ORGSY",
                      Value: "",
                      ResultType: 3,
                      Description: "Organism",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "EEC",
                      Value: "",
                      ResultType: 3,
                      Description: "eropathogenic E.coli",
                      IsResulted: false,
                    },
                    {
                      Type: 5,
                      Code: "REM",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                    {
                      Type: 5,
                      Code: "REM",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                    {
                      Type: 5,
                      Code: "REM",
                      Value: "F",
                      ResultType: 5,
                      Description: "arks",
                      IsResulted: true,
                    },
                  ],
                },
              },
              {
                DATESTAMP: "2019-01-09T09:13:58.257Z",
                LABNO: "FAKE0138895",
                TESTCODE: "MSENS",
                TESTINDEX: 2,
                ORDER: {
                  CODE: "MSENS",
                  ORDERS: [
                    {
                      Type: 3,
                      Code: "ORGS",
                      Value: "VIBCO",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: true,
                    },
                    {
                      Type: 3,
                      Code: "ORGS",
                      Value: "",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: false,
                    },
                    {
                      Type: 3,
                      Code: "ORGS",
                      Value: "",
                      ResultType: 3,
                      Description: "Pathogen Identified",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "CIPRO",
                      Value: "S",
                      ResultType: 4,
                      Description: "Ciprofloxacin",
                      IsResulted: true,
                    },
                    {
                      Type: 4,
                      Code: "OXACI",
                      Value: "",
                      ResultType: 4,
                      Description: "Oxacillin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "COTRI",
                      Value: "R",
                      ResultType: 4,
                      Description: "Cotrimoxazole",
                      IsResulted: true,
                    },
                    {
                      Type: 4,
                      Code: "CTX",
                      Value: "",
                      ResultType: 4,
                      Description: "Cefotaxime",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "NALID",
                      Value: "",
                      ResultType: 4,
                      Description: "Nalidixic Acid",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "AUGUM",
                      Value: "",
                      ResultType: 4,
                      Description: "Augumentin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "AMIK",
                      Value: "",
                      ResultType: 4,
                      Description: "Amikacin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "GENTA",
                      Value: "",
                      ResultType: 4,
                      Description: "Gentamicin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "AMP",
                      Value: "",
                      ResultType: 4,
                      Description: "Ampicillin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "MET",
                      Value: "",
                      ResultType: 4,
                      Description: "Methicillin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "CEF",
                      Value: "S",
                      ResultType: 4,
                      Description: "Ceftriaxone",
                      IsResulted: true,
                    },
                    {
                      Type: 4,
                      Code: "ERYTH",
                      Value: "",
                      ResultType: 4,
                      Description: "Erythromycin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "AZYT",
                      Value: "",
                      ResultType: 4,
                      Description: "Azythromycin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "TETRA",
                      Value: "S",
                      ResultType: 4,
                      Description: "Tetracycline",
                      IsResulted: true,
                    },
                    {
                      Type: 4,
                      Code: "CHLOR",
                      Value: "S",
                      ResultType: 4,
                      Description: "Chloramphenicol",
                      IsResulted: true,
                    },
                    {
                      Type: 4,
                      Code: "CARBE",
                      Value: "",
                      ResultType: 4,
                      Description: "Carbenicillin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "CLIND",
                      Value: "",
                      ResultType: 4,
                      Description: "Clindamycin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "NORF",
                      Value: "",
                      ResultType: 4,
                      Description: "Norfloxacin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "NITRO",
                      Value: "",
                      ResultType: 4,
                      Description: "Nitrofurantoin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "PIPER",
                      Value: "",
                      ResultType: 4,
                      Description: "Piperacillin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "CEFTA",
                      Value: "",
                      ResultType: 4,
                      Description: "Ceftazidime",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "TOBRA",
                      Value: "",
                      ResultType: 4,
                      Description: "Tobramycin",
                      IsResulted: false,
                    },
                    {
                      Type: 4,
                      Code: "CEPHA",
                      Value: "",
                      ResultType: 4,
                      Description: "Cephalothin",
                      IsResulted: false,
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
    };

    // Register function
    _window_.search = async function (input: any, jsonViewer: any) {
      try {
        const theme = localStorage.getItem("theme");

        jsonViewer.theme = theme === "dark" ? "default-dark" : "default-light";

        //fake an api call
        const data = fakeResponse();
        jsonViewer.data = data;
        jsonViewer.key = Math.random().toString(36);

        const { count, rows } = await sdk.api.data.feeds.getAll();
        if (rows) {
          //This can be improved but for demo process, it works
          const dataFeedId = rows.find(
            (feed: any) => feed.dataFeedName === "FakeLis Feed",
          )?.dataFeedId;
          const _data = data?.Data;
          if (dataFeedId && _data) {
            for (let x = 0; x < _data.length; x++) {
              const response = await sdk.api.data.processing.feedEntry(
                _data[x],
                dataFeedId,
              );
              // console.log(dataFeedId, response);
            }
          }
        }
      } catch (error) {
        console.error("Failed to execute command:", error);
      }
    };

    const getCurrentTheme = () => {
      if (document.documentElement.classList.contains("dark")) return "dark";
      if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        return "dark";
      return "light";
    };

    const jsxString = (theme: string) => {
      return `
<div class="flex flex-1 flex-col px-4 py-2 ">
  <div class="flex w-full flex-col max-h-[52px] min-h-[52px]">
    <div class="flex w-[100%] items-center py-2 my-0">
      <div data-slot="input-group" role="group" class="group/input-group border-input dark:bg-input/30 relative flex w-full items-center border shadow-xs transition-[color,box-shadow] outline-none h-9 min-w-0 has-[&gt;textarea]:h-auto has-[&gt;[data-align=inline-start]]:[&amp;&gt;input]:pl-2 has-[&gt;[data-align=inline-end]]:[&amp;&gt;input]:pr-2 has-[&gt;[data-align=block-start]]:h-auto has-[&gt;[data-align=block-start]]:flex-col has-[&gt;[data-align=block-start]]:[&amp;&gt;input]:pb-3 has-[&gt;[data-align=block-end]]:h-auto has-[&gt;[data-align=block-end]]:flex-col has-[&gt;[data-align=block-end]]:[&amp;&gt;input]:pt-3 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 rounded-[2px]">
        <input value="FAKE0138895" id="searchInput" data-slot="input-group-control" class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" placeholder="Search"><div role="group" data-slot="input-group-addon" data-align="inline-end" class="text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&amp;&gt;svg:not([class*='size-'])]:size-4 [&amp;&gt;kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50 order-last pr-3 has-[&gt;button]:mr-[-0.45rem] has-[&gt;kbd]:mr-[-0.35rem]"/>
        <button onclick="search(document.getElementById('searchInput'), document.getElementById('json'));" data-slot="button" class="justify-center whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*='size-'])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 text-sm shadow-none flex gap-2 items-center size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[&gt;svg]:p-0" type="button" data-size="icon-xs" aria-label="Search" title="Search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search" aria-hidden="true">
            <path d="m21 21-4.34-4.34"></path>
            <circle cx="11" cy="11" r="8"></circle>
          </svg>
        </button>
      </div>
    </div>
  </div>
  <div class="flex flex-1 flex-col my-2 border border-border overflow-y-auto" 
        style="min-height: calc(100vh - 52px - 52px - 16px);  max-height: calc(100vh - 52px - 52px - 16px);background-color: ${theme === "dark" ? "#181818" : "#ffffff"};"
  >
    <andypf-json-viewer 
      id="json" 
      indent="2"
      expanded="true"
      theme="${theme === "dark" ? "default-dark" : "default-light"}"
      show-data-types="false"
      show-toolbar="false"
      expand-icon-type="arrow"
      show-copy="false"
      show-size="false"
    ></andypf-json-viewer>
  </div>
</div>
`;
    };

    // Transform JSX string to React elements
    const MyComponent = () => {
      const theme = localStorage.getItem("theme") || getCurrentTheme();

      return React.createElement("div", {
        className: "flex flex-1 flex w-[100%] h-[100%] ",
        dangerouslySetInnerHTML: { __html: jsxString(theme) },
      });
    };

    const uiDisposable = exts.sdk.api.ui.registerUIComponent({
      id: "fakelis-extension-sidebar",
      extensionId: "org.openldr.extension.example.fakelis",
      component: MyComponent,
      slot: "sidebar",
    });
    context.subscriptions.push(uiDisposable);

    // Use storage
    await context.globalState.update("lastActivated", new Date().toISOString());
  },

  deactivate: async () => {
    // console.log("My extension is deactivating!");
  },
};

export default MyExtension;
