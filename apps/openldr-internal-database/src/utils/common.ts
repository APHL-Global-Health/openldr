export const createUUIDv7 = () => {
  const timestamp = BigInt(Date.now());
  const timestampHi = Number(timestamp >> 16n) & 0xffffffff;
  const timestampLo = Number(timestamp & 0xffffn);

  const randomBytes = new Uint32Array(3);
  crypto.getRandomValues(randomBytes);

  // Format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
  const uuid = [
    timestampHi.toString(16).padStart(8, "0"),
    ((timestampLo << 4) | (randomBytes[0]! >> 28))
      .toString(16)
      .padStart(4, "0"),
    (0x7000 | ((randomBytes[0]! >> 16) & 0x0fff)).toString(16),
    (0x8000 | ((randomBytes[0]! >> 2) & 0x3fff)).toString(16),
    (((randomBytes[0]! & 0x03) << 30) | (randomBytes[1]! >> 2))
      .toString(16)
      .padStart(8, "0"),
    (((randomBytes[1]! & 0x03) << 30) | (randomBytes[2]! >> 2))
      .toString(16)
      .padStart(8, "0"),
  ];

  return `${uuid[0]}-${uuid[1]}-${uuid[2]}-${uuid[3]}-${uuid[4]}${uuid[5]}`;
};

export const validUUID = (value: any) => {
  // validates all standard UUID formats (versions 1-8)
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(value)) {
    throw new Error("Invalid UUID format");
  }
};
