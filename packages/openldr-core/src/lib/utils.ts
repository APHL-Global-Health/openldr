/**
 * Schema definition for OpenLDR message metadata
 *
 * Enhanced to support universal data ingestion - any content type can be processed
 * while maintaining proper metadata tracking for downstream services.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Generates message metadata for MinIO object storage
 * @param {Object} params - Parameters for metadata generation
 * @param {Object} params.dataFeed - The data feed object containing project and use case information
 * @param {number} params.size - Size of the message in bytes
 * @param {string} params.status - Message status/data key
 * @param {string} [params.recipients="OpenLDRv2"] - Recipient of the message
 * @param {string} [params.messageId] - Optional message ID to preserve through processing chain
 * @param {string} [params.messageDateTime] - Optional message datetime to preserve through processing chain
 * @param {string} [params.messageContentType] - MIME content type of the message (e.g., 'application/hl7-v2', 'application/json')
 * @param {string} params.fileFormat - File extension for the current processing stage (e.g., '.hl7', '.xml', '.json')
 * @param {string} [params.userId] - User ID if applicable
 * @returns {Object} Formatted metadata object
 */
export function generateMessageMetadata({
  dataFeed,
  size,
  status,
  recipients = "OpenLDRv2",
  messageId,
  messageDateTime,
  messageContentType = "application/octet-stream",
  fileFormat = ".txt",
  userId = null,
}: {
  dataFeed: any;
  size: number;
  status: string;
  recipients?: string;
  messageId?: string;
  messageDateTime?: string;
  messageContentType?: string;
  fileFormat?: string;
  userId?: string | null;
}) {
  const now = new Date();
  const currentDateTime = now
    .toISOString()
    .replace("T", " ")
    .replace("Z", "+0000");

  // Generate a UUID v4 for guaranteed global uniqueness
  // Example: 123e4567-e89b-12d3-a456-426614174000
  // This ensures no two messages can have the same ID, even across different OpenLDR instances
  const generateMessageId = () => {
    return uuidv4();
  };

  // Use provided values or generate new ones
  const finalMessageId = messageId || generateMessageId();
  const finalMessageDateTime = messageDateTime || currentDateTime;

  // Generate filename with appropriate extension based on file format
  const fileName = `${status}/${dataFeed.dataFeedId}/${finalMessageId}${fileFormat}`;

  return {
    Environment: [process.env.HOST_ENVIRONMENT],
    FileName: fileName,
    Size: size,
    MessageDateTime: finalMessageDateTime,
    MessageId: finalMessageId,
    Senders: dataFeed.dataFeedName,
    Project: dataFeed.project.projectName,
    UseCase: dataFeed.useCase.useCaseName,
    Recipients: recipients,
    UserId: userId,
    Status: status,
    MessageContentType: messageContentType,
    FileFormat: fileFormat,
  };
}

export const envsubst = (str: string): string => {
  return str.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || "");
};
