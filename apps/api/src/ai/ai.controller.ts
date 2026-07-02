import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { OrgRole, generateCardSchema, type GenerateCardInput } from "@taskora/shared";
import { CardGenerationQueue } from "./card-generation.queue";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/ai")
export class AiController {
  constructor(private readonly queue: CardGenerationQueue) {}

  @RequireRole(OrgRole.Member)
  @Post("generate-card")
  generateCard(@Body(new ZodValidationPipe(generateCardSchema)) body: GenerateCardInput) {
    return this.queue.enqueue(body.prompt);
  }

  @RequireRole(OrgRole.Member)
  @Get("generate-card/:jobId")
  getStatus(@Param("jobId") jobId: string) {
    return this.queue.getStatus(jobId);
  }
}
