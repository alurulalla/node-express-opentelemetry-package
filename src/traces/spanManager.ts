import { api } from "@opentelemetry/sdk-node";
import { Attributes, Span, SpanKind, SpanStatusCode } from "@opentelemetry/api";

/**
 * Creates a new inactive Span in the current tracer context
 * If already exist any active span, creates a child inactive span and the current active span as parent
 * Any update should applied to the span returned
 * The span returned should be closed 'span.end()' to finish the trace
 * @param spanName 
 * @param kind 
 * @param attributes 
 * @returns 
 */
export function createSpan(spanName: string, kind?: SpanKind, attributes?: Attributes): Span {

    if (!process.env.npm_package_name) {
        throw new Error("No service package name found while creating span");
    }
    const tracer = api.trace.getTracer(process.env.npm_package_name);
    const span = tracer.startSpan(spanName, {
        startTime: new Date(),
        kind,
        attributes,
    });
    return span;
}

/**
 * Decorator for async method
 * Creates a new span before execution and end it once the execution finishes
 * If any current active span exist, the span created will be a child span
 * If doesn't exist any current span, creates a new root span 
 * @param spanName name to identify the created span
 * @param kind type of span created
 * @param attributes aditional data attributes for span. Could be updated using updateSpan function
 * @returns 
 */
export function trace(spanName: string, kind?: SpanKind, attributes?: Attributes) {
    return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
        console.log(`Applying tracing to ${propertyKey} method`);
        const decoratedFunction = descriptor.value;

        if (!process.env.npm_package_name) {
            throw new Error("No service package name found while creating span");
        }

        descriptor.value = function (...args: unknown[]) {
            console.log(`Executing ${propertyKey}`);
            if (!process.env.npm_package_name) {
                throw new Error("No service package name found while creating span");
            }
            const tracer = api.trace.getTracer(process.env.npm_package_name);
            let result: unknown;
            tracer.startActiveSpan(spanName, { kind, attributes }, span => {
                console.log(`Creating new span for ${propertyKey} method`);
                result = decoratedFunction.apply(this, args);
                console.log(`${propertyKey} was executed`);
                span.end();

            });
            return result;
        };
        return descriptor;

    }
}

/**
 * Update name, status or attributes of the current active span if needed
 * @param spanName 
 * @param status 
 * @param attributes 
 */
export function updateActiveSpan(spanName?: string, status?: api.SpanStatus, attributes?: Attributes) {

    if (spanName) {
        api.trace.getActiveSpan()?.updateName(spanName);
    }
    if (status) {
        api.trace.getActiveSpan()?.setStatus(status);
    }
    if (attributes) {
        api.trace.getActiveSpan()?.setAttributes(attributes);
    }
}

/**
 * Add new event to current active span
 * A event identify by a name that contains some attributes used to trace and specific event
 * Recommend to add aditional data to span
 * @param name 
 * @param attributes 
 * @param startTime 
 */
export function addEventSpan(name: string, attributes?: Attributes, startTime?: Date) {
    api.trace.getActiveSpan()?.addEvent(name, attributes, startTime ?? new Date());
}

/**
 * Record exception in the current span and update the status to Error
 * @param error 
 * @param message 
 */
export function traceExpcetionSpan(error: Error, message?: string) {
    api.trace.getActiveSpan()?.recordException(error);
    api.trace.getActiveSpan()?.setStatus({
        code: SpanStatusCode.ERROR,
        message
    });
}
