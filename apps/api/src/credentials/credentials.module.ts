import { Module } from "@nestjs/common";
import { CredentialsService } from "./credentials.service";
import { CredentialsController } from "./credentials.controller";

@Module({
  providers: [CredentialsService],
  controllers: [CredentialsController],
  // بتصدّر الخدمة عشان موصّلات الأدوات (Connectors) تقرأ السرّ داخليًا.
  exports: [CredentialsService],
})
export class CredentialsModule {}
