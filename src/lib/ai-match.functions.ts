import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const CandidateDonor = z.object({
  id: z.string(),
  full_name: z.string(),
  age: z.number().nullable(),
  blood_type: z.string(),
  organ: z.string(),
  city: z.string().nullable(),
  hospital_name: z.string().nullable(),
  status: z.string(),
});

const CandidateRecipient = z.object({
  id: z.string(),
  full_name: z.string(),
  age: z.number().nullable(),
  blood_type: z.string(),
  organ_needed: z.string(),
  urgency: z.string(),
  city: z.string().nullable(),
  hospital_name: z.string().nullable(),
  status: z.string(),
});

const Input = z.object({
  caseDescription: z.string().min(10).max(4000),
  donors: z.array(CandidateDonor).max(200),
  recipients: z.array(CandidateRecipient).max(200),
});

const Suggestion = z.object({
  donor_id: z.string().describe("id of a donor from the provided donor list"),
  recipient_id: z.string().describe("id of a recipient from the provided recipient list"),
  donor_name: z.string(),
  recipient_name: z.string(),
  confidence: z.number().describe("confidence from 0 to 100"),
  rationale: z.string().describe("two short sentences explaining the pairing"),
  concerns: z.string().describe("key clinical or logistical concerns, or 'None noted'"),
});

const Result = z.object({
  summary: z.string().describe("one short paragraph summarising the assessment"),
  suggestions: z.array(Suggestion).describe("up to 5 pairings, best first"),
});

export type AiMatchResult = z.infer<typeof Result>;

const SYSTEM = `You are a transplant coordination decision-support assistant.
Given a coordinator's free-text case description plus the current donor and recipient registry,
suggest the most plausible donor-recipient pairings.
Rules:
- Only use donors and recipients from the provided lists; copy their ids exactly.
- The organ must match the organ needed.
- Respect ABO compatibility (O- donates to all; AB+ receives from all).
- Favour higher urgency, closer geography and the same hospital where possible.
- Return at most 5 pairings, best first. If nothing is plausible, return an empty list and explain why in the summary.
- You provide decision support only; a clinician makes the final call. Never invent patients.`;

export const suggestMatches = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch as typeof fetch,
    });

    const prompt = [
      "Coordinator case description:",
      data.caseDescription,
      "",
      "Available donors (JSON):",
      JSON.stringify(data.donors),
      "",
      "Waiting recipients (JSON):",
      JSON.stringify(data.recipients),
    ].join("\n");

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM,
        prompt,
        output: Output.object({ schema: Result }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const output = (await result.output) as AiMatchResult;
      return {
        summary: output.summary,
        suggestions: (output.suggestions ?? []).slice(0, 5),
      } satisfies AiMatchResult;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return {
          summary: "The assistant could not produce a structured recommendation. Please refine the case description and try again.",
          suggestions: [],
        } satisfies AiMatchResult;
      }
      throw error;
    }
  });
