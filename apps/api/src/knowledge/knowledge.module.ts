import { Module } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeController } from "./knowledge.controller";

@Module({
  providers: [KnowledgeService],
  controllers: [KnowledgeController],
  // بتصدّر الخدمة عشان AiService يستخدم retrieve() أثناء التنفيذ (RAG).
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
