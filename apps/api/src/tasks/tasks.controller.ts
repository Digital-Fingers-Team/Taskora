import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  createTaskSchema,
  assignTaskSchema,
  submitTaskSchema,
  reviewTaskSchema,
  addExecutionLogSchema,
  sendChatMessageSchema,
  type CreateTaskInput,
  type AssignTaskInput,
  type SubmitTaskInput,
  type ReviewTaskInput,
  type AddExecutionLogInput,
  type SendChatMessageInput,
  type AuthUser,
} from "@taskora/shared";
import { TasksService } from "./tasks.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequireRole(OrgRole.Operator)
  @Get()
  list(@Param("orgId") orgId: string, @Query("mine") mine: string | undefined, @CurrentUser() user: AuthUser) {
    return this.tasks.list(orgId, mine === "true" ? user.id : undefined);
  }

  @RequireRole(OrgRole.Operator)
  @Get(":taskId")
  get(@Param("orgId") orgId: string, @Param("taskId") taskId: string) {
    return this.tasks.get(orgId, taskId);
  }

  @RequireRole(OrgRole.Member)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasks.create(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Patch(":taskId/assign")
  assign(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(assignTaskSchema)) body: AssignTaskInput,
  ) {
    return this.tasks.assign(orgId, taskId, body);
  }

  @RequireRole(OrgRole.Operator)
  @Patch(":taskId/start")
  start(@Param("orgId") orgId: string, @Param("taskId") taskId: string, @CurrentUser() user: AuthUser) {
    return this.tasks.start(orgId, taskId, user.id);
  }

  @RequireRole(OrgRole.Operator)
  @Post(":taskId/logs")
  addLog(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addExecutionLogSchema)) body: AddExecutionLogInput,
  ) {
    return this.tasks.addLog(orgId, taskId, user.id, body);
  }

  @RequireRole(OrgRole.Operator)
  @Patch(":taskId/submit")
  submit(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(submitTaskSchema)) body: SubmitTaskInput,
  ) {
    return this.tasks.submit(orgId, taskId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Patch(":taskId/review")
  review(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(reviewTaskSchema)) body: ReviewTaskInput,
  ) {
    return this.tasks.review(orgId, taskId, body);
  }

  @RequireRole(OrgRole.Operator)
  @Get(":taskId/chat")
  listChat(@Param("orgId") orgId: string, @Param("taskId") taskId: string) {
    return this.tasks.listChat(orgId, taskId);
  }

  @RequireRole(OrgRole.Operator)
  @Post(":taskId/chat")
  chat(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(sendChatMessageSchema)) body: SendChatMessageInput,
  ) {
    return this.tasks.chat(orgId, taskId, user.id, body.message);
  }
}
