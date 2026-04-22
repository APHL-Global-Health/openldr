import express from "express";
import {
  getUniqueDataFeedsProjectsUseCases,
  getIndexDocumentCounts,
  getMessageCountsByInterval,
  getLatestMessages,
} from "../services/opensearch.service";

const router = express.Router();

router.get("/", async function (req, res) {
  try {
    const { index /*, startDateTime, endDateTime*/ } = req.query;

    if (!index /*|| !startDateTime || !endDateTime*/) {
      return res.status(400).json({
        error:
          "Missing required query parameters: index, startDateTime, endDateTime",
      });
    }
    const response = await getUniqueDataFeedsProjectsUseCases(
      index,
      // startDateTime,
      // endDateTime
    );
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching data from OpenSearch:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/index-document-count", async function (_req, res) {
  try {
    // const { startDateTime, endDateTime } = req.query;
    // if (!startDateTime || !endDateTime) {
    //   return res.status(400).json({
    //     error: "Missing required query parameters: startDateTime, endDateTime",
    //   });
    // }
    // const response = await getIndexDocumentCounts(startDateTime, endDateTime);
    const response = await getIndexDocumentCounts();
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching data from OpenSearch:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/interval-message-count", async function (_req, res) {
  try {
    // const { startDateTime, endDateTime } = req.query;
    // if (!startDateTime || !endDateTime) {
    //   return res.status(400).json({
    //     error: "Missing required query parameters: startDateTime, endDateTime",
    //   });
    // }
    // const response = await getMessageCountsByInterval(
    //   startDateTime,
    //   endDateTime
    // );
    const response = await getMessageCountsByInterval();
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching data from OpenSearch:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/latest-messages", async function (_req, res) {
  try {
    // const { startDateTime, endDateTime } = req.query;
    // if (!startDateTime || !endDateTime) {
    //   return res.status(400).json({
    //     error: "Missing required query parameters: startDateTime, endDateTime",
    //   });
    // }
    // const response = await getLatestMessages(
    //   startDateTime,
    //   endDateTime
    // );
    const response = await getLatestMessages();
    res.status(200).json(response);
  } catch (error: any) {
    console.error("Error fetching data from OpenSearch:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
