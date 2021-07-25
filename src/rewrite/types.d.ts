export interface SegmentFields {
  traceId: string;
  service: string;
  spans: SpanFields[];
  serviceInstance: string;
  traceSegmentId: string;
}

export interface SpanFields {
  operationName: string;
  startTime: number;
  endTime: number;
  spanId: number;
  spanLayer: string;
  spanType: string;
  isError: boolean;
  parentSpanId: number;
  componentId: number;
  peer: string;
  tags?: any;
}
