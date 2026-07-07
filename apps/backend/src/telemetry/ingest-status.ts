/**
 * Mirrors the `IngestStatus` enum in telemetry.proto. The backend loads the
 * proto dynamically (via @grpc/proto-loader) so there is no generated TS enum;
 * these numeric values must stay in sync with the .proto definition.
 */
export enum IngestStatus {
  UNSPECIFIED = 0,
  ACCEPTED = 1,
  DUPLICATE = 2,
  RETRY = 3,
  UNAUTHENTICATED = 4,
}

export type IngestAck = {
  ok: boolean;
  message: string;
  status: IngestStatus;
};

export function ingestAck(status: IngestStatus, message: string): IngestAck {
  return {
    ok:
      status === IngestStatus.ACCEPTED || status === IngestStatus.DUPLICATE,
    message,
    status,
  };
}
