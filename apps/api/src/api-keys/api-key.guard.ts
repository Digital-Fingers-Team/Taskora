import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiKeysService } from "./api-keys.service";

/** سياق المنظمة اللي بيتحطّ على الطلب بعد التحقق من مفتاح الـ API. */
export interface ApiKeyContext {
  organizationId: string;
  /** منشئ المفتاح — بيُستخدم كصاحب الطلب للموارد اللي بتتعمل عبر الـ API. */
  createdById: string;
}

/**
 * حارس الـ Public API (v1). بيقرأ المفتاح من هيدر `X-Api-Key` أو
 * `Authorization: Bearer tk_...`، بيتحقق منه، وبيحطّ سياق المنظمة على الطلب.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { apiKey?: ApiKeyContext }>();
    const raw = this.extract(req);
    if (!raw) throw new UnauthorizedException("مفتاح API مطلوب");

    const result = await this.apiKeys.verify(raw);
    if (!result) throw new UnauthorizedException("مفتاح API غير صالح");

    req.apiKey = result;
    return true;
  }

  private extract(req: Request): string | null {
    const header = req.header("x-api-key");
    if (header) return header;
    const auth = req.header("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return null;
  }
}
