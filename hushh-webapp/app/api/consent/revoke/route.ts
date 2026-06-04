// app/api/consent/revoke/route.ts

/**
 * Revoke Consent API
 *
 * Revokes an active consent token, removing access for the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";
import {
  invalidJsonPayloadResponse,
  readJsonObject,
} from "@/app/api/_utils/json-body";
import { resolveConsentState } from "@/lib/consent/overrideEvaluator";

const BACKEND_URL = getPythonApiUrl();

export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonObject(request)) as {
      userId?: string;
      scope?: string;
      globalStatus?: unknown;
      localOverride?: unknown;
    } | null;
    if (!body) {
      return invalidJsonPayloadResponse();
    }
    const { userId, scope, globalStatus, localOverride } = body;

    // Resolve the effective consent state from the two-tier cascade before
    // forwarding to the backend.  When a caller supplies explicit state flags
    // and the resolved state is already inactive (false), the consent is
    // already revoked — return early rather than sending a no-op to the
    // Python service.
    if (globalStatus !== undefined || localOverride !== undefined) {
      const effectiveConsent = resolveConsentState(globalStatus, localOverride);
      if (!effectiveConsent) {
        return NextResponse.json(
          {
            status: "already_inactive",
            message: "Consent is already inactive — revocation is a no-op",
          },
          { status: 200 }
        );
      }
    }
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    if (!userId || !scope) {
      return NextResponse.json(
        { error: "userId and scope are required" },
        { status: 400 },
      );
    }
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 },
      );
    }

    console.log(`[API] Revoking consent for scope: ${scope}`);

    const backendUrl = `${BACKEND_URL}/api/consent/revoke`;
    console.log(`[API] Calling backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ userId, scope }),
    });

    const responseText = await response.text();
    console.log(`[API] Backend response status: ${response.status}`);
    console.log(`[API] Backend response body: ${responseText}`);

    if (!response.ok) {
      console.error("[API] Backend error:", responseText);
      return NextResponse.json(
        { error: responseText || "Failed to revoke consent" },
        { status: response.status },
      );
    }

    // Parse JSON response
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ status: "revoked", raw: responseText });
    }
  } catch (error) {
    console.error("[API] Revoke consent error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error}` },
      { status: 500 },
    );
  }
}
