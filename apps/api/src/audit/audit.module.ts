import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";

/**
 * سجل التدقيق (المرحلة 7). Global عشان أي service يقدر يسجّل تغيير
 * (cards / billing / webhooks / apikeys) من غير ما يستورد الموديول.
 */
@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
