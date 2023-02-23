import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  BatchSpanProcessor,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { WinstonInstrumentation } from "@opentelemetry/instrumentation-winston";
import { InstrumentationOption } from "@opentelemetry/instrumentation/build/src/types_internal";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

export function initInstrumentation(
  aditionalInstrumentations?: InstrumentationOption[],
  spanExporter?: SpanExporter
) {
  if (process.env.OTEL_DEBUG_LOGGING?.toLowerCase() === "true") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  if (!process.env.npm_package_name) {
    throw new Error(
      "No service package name found while creating resource for tracing"
    );
  }

  if (!process.env.npm_package_version) {
    throw new Error(
      "No service package version found while creating resource for tracing"
    );
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.npm_package_name,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version,
    }),
  });

  let instrumentations: InstrumentationOption[] = [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new WinstonInstrumentation(),
  ];

  if (aditionalInstrumentations) {
    instrumentations = instrumentations.concat(aditionalInstrumentations);
  }

  let exporter: SpanExporter;

  if (spanExporter) {
    console.log("Overriding exporter instrumentation");
    exporter = spanExporter;
  } else {
    console.log("Using default dynatrace exporter");

    exporter = new OTLPTraceExporter({
      url: process.env.DYNATRACE_EXPORTER_URL,
      headers: {
        Authorization: `Api-Token ${process.env.DYNATRACE_EXPORTER_TOKEN}`,
      },
    });
  }

  const spanProcessor = new BatchSpanProcessor(exporter);
  provider.addSpanProcessor(spanProcessor);

  provider.register();

  //   registerInstrumentations({
  //     instrumentations: [getNodeAutoInstrumentations()],
  //   });
}
