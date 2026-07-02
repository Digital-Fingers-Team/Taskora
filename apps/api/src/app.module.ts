import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { CardsModule } from "./cards/cards.module";
import { TasksModule } from "./tasks/tasks.module";
import { BillingModule } from "./billing/billing.module";
import { ReputationModule } from "./reputation/reputation.module";
import { AiModule } from "./ai/ai.module";
import { EventsModule } from "./events/events.module";
import { AuditModule } from "./audit/audit.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { PublicApiModule } from "./public-api/public-api.module";
import { CryptoModule } from "./crypto/crypto.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { QualityModule } from "./quality/quality.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // مصدر الحقيقة هو .env في جذر المونوريبو.
      envFilePath: ["../../.env", ".env"],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    OrganizationsModule,
    CardsModule,
    TasksModule,
    BillingModule,
    ReputationModule,
    AiModule,
    EventsModule,
    AuditModule,
    WebhooksModule,
    NotificationsModule,
    ApiKeysModule,
    PublicApiModule,
    CryptoModule,
    CredentialsModule,
    ConnectorsModule,
    KnowledgeModule,
    MarketplaceModule,
    QualityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
