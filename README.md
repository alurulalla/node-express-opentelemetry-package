# node-express-opentelemetry-package

## Set up
This package contains the configuration to set up OpenTelemetry in an Express application so that logs and client API calls will have the tracing headers defined by the OpenTelemetry standard. 

To set up opentelemetry instrumentation create the route `optl` in `src` and add a new `index.ts` file with the following content

```typescript
// src/optl/index.ts

import { initInstrumentation } from '@metronetinc/node-express-opentelemetry-package';

initInstrumentation();

```
The package requieres the next environment variables in order to configure the tracer and span exporter 
- `OTEL_DEBUG_LOGGING`: set *"true"* for enable the *DEBUG* level logging for OpenTelemetry packages
- `DYNATRACE_EXPORTER_URL`: URL for dynatrace endpoint that will collect the traces
- `DYNATRACE_EXPORTER_TOKEN`: Secret token for dynatrace endpoint that will collect the traces

At starting, OpenTelemetry package will create a tracer with `npm_package_name` and `npm_package_version` as name and version tracer resource.

Update the `dev` and `start` scripts in the `package.json` requiring the `node-express-opentelemetry-package` module initialization:

```json
{
  "dev": "nodemon -r dotenv/config -r ./build/optl build/server.js",
}
```

This will require the opentelemetry instrumentation before running the app, this is need to ensure the modules instrumentation is loaded before the express application.

## Extending instrumentation
The current package only add instrumentation for express controllers, http calling api and winston logger. Is possible add new opentelemetry modules for additional instrumentation required in some projects. The `initInstrumentation` function takes an `InstrumentationOption` array to extend the instrumentation

This is an example of adding kafka instrumentation if required:
1. Install the opentelemetry instrumentation module
``` bash
yarn add opentelemetry-instrumentation-kafkajs
```
2. Update your `src/optl/index.ts` like this:
```typescript
import { initInstrumentation } from '@metronetinc/node-express-opentelemetry-package';
import { KafkaJsInstrumentation } from 'opentelemetry-instrumentation-kafkajs';

initInstrumentation([
  new KafkaJsInstrumentation(),
  // add another opentelemetry instrumentation module
  ]);

```
This will add kafka-js automatic instrumentation, creating a new child span for every kafka calling.

## Local development set up
In order to perform local testing, the span exporter processor can be overridden using another OpenTelemetry exporter. It is recommended use Zipkin that could be set up easily using docker.

1. Run Zipkin as local docker container using:

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

2. Install the Zipkin span exporter as dev dependency
```bash
yarn add -D @opentelemetry/exporter-zipkin
```
3. Update your `src/optl/index.ts` like this:
```typescript
import { initInstrumentation } from '@metronetinc/node-express-opentelemetry-package';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { KafkaJsInstrumentation } from 'opentelemetry-instrumentation-kafkajs';

if (process.env.ENVIRONMENT === "local") {
    initInstrumentation( 
      [new KafkaJsInstrumentation()],
      new ZipkinExporter({
        url: 'http://localhost:9411/api/v2/spans',
        serviceName: process.env.npm_package_name,
      })
      );
} else {
    initInstrumentation([new KafkaJsInstrumentation()]);
}


```
You will able to check the traces collected on local browser [Zipkin Local](http://localhost:9411/zipkin/)

## Usage
OpenTelemetry creates automaticly the traces for every incoming request recibed in the express controllers, the spans created get its name according the current process in the request.

For example, a GET request to `/tmf-api/api-name/v1/service-health` endpoint would create the following spans:
- Root Active span named `"get /tmf-api/account-management/v1/service-health"`
- child span named: `"middleware - query"`
- child span named: `"middleware - expressinit"`
- child span named: `"middleware - jsonparser"`
- child span named: `"middleware - servestatic"`
- child span named: `"request handler - /tmf-api/account-management/v1/service-health"`

Every child span will be related to the root span creating an unique trace.
The http requests made during processing the current incoming request will get injected the current context and sent along the http request in the headers. If the child service API has its own OpenTelemetry instrumentation, the spans created in this aditional service will be child spans too. Ultimately, all the spans collected through differents services makes a entire trace.

The node-express-opentelemetry-package exposes functions to perform some updates needed to the active span (root span).

- `updateActiveSpan` : Allow update either name, status or add attributes to the active span
```typescript
//signature
function updateActiveSpan(spanName?: string, status?: api.SpanStatus, attributes?: Attributes) : void;

//examples
updateActiveSpan("new SpanName");

updateActiveSpan(undefined, {
  code: SpanStatusCode.ERROR, //import { SpanStatusCode } from "@opentelemetry/api";
  message: "Span status message" //optional string message
  });

updateActiveSpan(undefined, undefined, 
{ 
  "key" : value // string | number | boolean | Array<null | undefined | string> | Array<null | undefined | number> | Array<null | undefined | boolean>  
  });
```

- `addEventSpan` : Add a new event to active span identified by a name
```typescript
//signature
function addEventSpan(name: string, attributes?: Attributes, startTime?: Date) : void;

//example
addEventSpan(
  "new event", 
  {
    "key" : value // string | number | boolean | Array<null | undefined | string> | Array<null | undefined | number> | Array<null | undefined | boolean>  
  },
  new Date() // new Date if undefined
  );
```

- `traceExpcetionSpan` : Add and error to the active trace and record it. The span status is updated to `SpanStatusCode.ERROR`
```typescript
//signature
function traceExpcetionSpan(error: Error, message?: string) : void;

//example
traceExpcetionSpan(new Error("error"), "optional span status message");

```
## Aditional Tracing
In order to create traces for async methods executed by another process aside http incomming request, the package exposes a method decorator that creates a new active span for every methods execution.

- `trace` : Method Decotador that allow add a new active span. 
  - If exist any active span, the new span will be child of current active span. 
  - If doesn't exist any current active span, the new span created will be a root. 
  
The active span created could be updated inside the decorated method through the previous functions

```typescript
//signature
function trace(spanName: string, kind?: SpanKind, attributes?: Attributes);

//example
//import { SpanKind } from "@opentelemetry/api";

class example {

  @trace("methodClass", SpanKind.PRODUCER)
  async runMethod(){
    try {
      //get some data 
      updateActiveSpan(undefined, undefined, {"data" : data});

      //some event occur
      addEventSpan("some event", {name: "event"});

      //call REST client
      //the http request will create a new span and propagate the current context in the headers

    } catch(error: Error) {
      //handle error
      traceExpcetionSpan(error, "Error on producer");
    }
  }
}
```

Additionaly, it could be created a new inactive span using the `createSpan` function:
- `createSpan` : Allow a new inactive span, the span will be child to the current active span. The span created could not be used as root span
```typescript
//signature
function createSpan(spanName: string, kind?: SpanKind, attributes?: Attributes): Span;

//example
const span = createSpan("child-span");
//the span could be updated using the object returned
span.addEvent("event", {name: "eventName"});
span.setAttribute("key", "value");

//The span should be ended
span.end();
```
