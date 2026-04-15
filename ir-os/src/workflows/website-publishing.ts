import type { WorkflowStep, UserId, ArtifactType } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * IR WEBSITE PUBLISHING WORKFLOW
 *
 * Validates and prepares content for the IR website.
 * Publishing is ALWAYS a human action — the workflow ends with human execution.
 *
 * Total steps: 5
 * Human checkpoints: 2 (steps 3, 5)
 */
export function buildWebsitePublishingSteps(
  artifactId: string,
  artifactType: ArtifactType,
  pageIdentifier: string
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    {
      stepId: "WP-01-READINESS",
      stepName: "Publication Readiness Check",
      agentId: "ir-website",
      input: {
        action: "PUBLICATION_READINESS_CHECK",
        artifactId,
        artifactType,
        pageIdentifier,
      },
      notes: "Check: APPROVED status, approval records, no blocking flags, simultaneous release coordination.",
    },
    {
      stepId: "WP-02-DRAFT-PAGE",
      stepName: "Draft Page Update",
      agentId: "ir-website",
      input: {
        action: "DRAFT_PAGE_UPDATE",
        artifactId,
        pageIdentifier,
      },
      notes: "Stage the approved content for the target page. Status = DRAFT.",
    },
    {
      stepId: "WP-03-GATEKEEPER",
      stepName: "Final Compliance Check",
      agentId: "disclosure-gatekeeper",
      input: {
        contentType: artifactType,
        proposedClassification: "PUBLIC",
        context: "Final web publishing check.",
      },
      notes: "Gatekeeper confirms no compliance issues with final web-ready version.",
    },
    {
      stepId: "WP-04-ARCHIVE",
      stepName: "Archive Previous Content",
      agentId: "ir-website",
      input: {
        action: "ARCHIVE_OLD_CONTENT",
        pageIdentifier,
      },
      notes: "Mark prior version of the page for archiving once new content is live.",
    },
    {
      stepId: "WP-05-PUBLISH",
      stepName: "Human: Execute Web Publish",
      agentId: "HUMAN",
      input: {
        instruction: `IR / Communications: publish the approved content to the IR website page "${pageIdentifier}".
This must occur SIMULTANEOUSLY with any associated CVM filing or press release.
No agent publishes this content — you must execute through the CMS.
Record the publication timestamp.`,
      },
      notes: "HUMAN CHECKPOINT: manual CMS publish. Must be simultaneous with regulatory filings.",
    },
  ];
}

export async function createWebsitePublishingWorkflow(
  engine: WorkflowEngine,
  artifactId: string,
  artifactType: ArtifactType,
  pageIdentifier: string,
  initiatedBy: UserId
): Promise<string> {
  const steps = buildWebsitePublishingSteps(artifactId, artifactType, pageIdentifier);
  const instance = await engine.create(
    "WEBSITE_PUBLISHING",
    initiatedBy,
    { artifactId, artifactType, pageIdentifier },
    steps,
    "HIGH"
  );
  return instance.workflowId;
}
