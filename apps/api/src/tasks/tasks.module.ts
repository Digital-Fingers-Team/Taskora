import { Module } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { BillingModule } from "../billing/billing.module";
import { AiModule } from "../ai/ai.module";
import { CardsModule } from "../cards/cards.module";

@Module({
  imports: [BillingModule, AiModule, CardsModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
