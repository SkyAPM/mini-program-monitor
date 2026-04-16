export interface SpanTag {
  key: string;
  value: string;
}

export interface SpanObject {
  operationName: string;
  startTime: number;
  endTime: number;
  spanId: number;
  parentSpanId: number;
  spanLayer: string;
  spanType: string;
  isError: boolean;
  componentId: number;
  peer: string;
  tags?: SpanTag[];
}

export interface SegmentObject {
  traceId: string;
  traceSegmentId: string;
  service: string;
  serviceInstance: string;
  spans: SpanObject[];
}
