import { Module } from "@nestjs/common";
import { AgentOrchestratorService } from "./agent-orchestrator.service";
import { AgentOrchestratorController } from "./agent-orchestrator.controller";
import { AiModule } from "../ai/ai.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";

@Module({
  imports: [AiModule, KnowledgeModule],
  providers: [AgentOrchestratorService],
  controllers: [AgentOrchestratorController],
})
export class AgentOrchestratorModule {}
