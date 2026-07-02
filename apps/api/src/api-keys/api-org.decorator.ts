import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { ApiKeyContext } from "./api-key.guard";

/** بيرجّع سياق المنظمة اللي حطّه ApiKeyGuard على الطلب. */
export const ApiOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const req = ctx.switchToHttp().getRequest<{ apiKey: ApiKeyContext }>();
    return req.apiKey;
  },
);
