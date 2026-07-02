import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  createTaskSchema,
  createCardSchema,
  reviewTaskSchema,
  type CreateTaskInput,
  type CreateCardInput,
  type ReviewTaskInput,
} from "@taskora/shared";
import { ApiKeyGuard, type ApiKeyContext } from "../api-keys/api-key.guard";
import { ApiOrg } from "../api-keys/api-org.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { TasksService } from "../tasks/tasks.service";
import { CardsService } from "../cards/cards.service";

/**
 * الـ Public API (المرحلة 7). موثّق بـ Swagger على /api/docs. مُصدّر بنسخة v1
 * عشان نطوّر من غير ما نكسر العملاء. التصريح بمفتاح API (X-Api-Key) مش JWT.
 */
@UseGuards(ApiKeyGuard)
@Controller("v1")
export class PublicApiController {
  constructor(
    private readonly tasks: TasksService,
    private readonly cards: CardsService,
  ) {}

  @Post("tasks")
  createTask(
    @ApiOrg() ctx: ApiKeyContext,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasks.create(ctx.organizationId, ctx.createdById, body);
  }

  @Get("tasks/:taskId")
  getTask(@ApiOrg() ctx: ApiKeyContext, @Param("taskId") taskId: string) {
    return this.tasks.get(ctx.organizationId, taskId);
  }

  @Post("cards")
  createCard(
    @ApiOrg() ctx: ApiKeyContext,
    @Body(new ZodValidationPipe(createCardSchema)) body: CreateCardInput,
  ) {
    return this.cards.create(ctx.organizationId, ctx.createdById, body);
  }

  @Get("executions")
  listExecutions(@ApiOrg() ctx: ApiKeyContext) {
    return this.tasks.listExecutions(ctx.organizationId);
  }

  @Post("tasks/:taskId/review")
  review(
    @ApiOrg() ctx: ApiKeyContext,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(reviewTaskSchema)) body: ReviewTaskInput,
  ) {
    return this.tasks.review(ctx.organizationId, taskId, body);
  }
}
