// app/api/consent/canvas-guard/route.ts

/**
 * Canvas Fingerprint Guard API
 *
 * Receives canvas API telemetry events from the client privacy layer and
 * evaluates whether the observed call pattern constitutes a device
 * fingerprinting probe.  Blocked probes are returned with HTTP 403 so the
 * client can halt the canvas operation and record the consent violation.
 *
 * This route is the production attach-point for isCanvasFingerprintAttempt.
 * Every telemetry event submitted to this endpoint passes through the
 * detector before any response is returned.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCanvasFingerprintAttempt } from "@/lib/privacy/canvasDetector";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, callCount } = body as {
      method?: unknown;
      callCount?: unknown;
    };

    if (isCanvasFingerprintAttempt(method, callCount)) {
      return NextResponse.json(
        {
          blocked: true,
          method: String(method),
          callCount: Number(callCount),
          reason: `canvas fingerprint probe detected: "${String(method)}" called ${String(callCount)} times — exceeds threshold`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      blocked: false,
      method: method ?? null,
      callCount: callCount ?? null,
      reason: "no fingerprint signal detected",
    });
  } catch (error) {
    console.error("[Canvas Guard] Error evaluating canvas event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
