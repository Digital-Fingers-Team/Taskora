import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.API_CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  });
  // التحقق من المدخلات بيتم عبر ZodValidationPipe على مستوى كل endpoint
  // باستخدام schemas الـ @taskora/shared — مش محتاجين class-validator.

  // توثيق الـ Public API (المرحلة 7) — عشان الشركات تدمج Taskora في أنظمتها.
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Taskora Public API")
    .setDescription("API عام (v1) للتكامل البرمجي — تصريح بمفتاح API عبر هيدر X-Api-Key.")
    .setVersion("1.0")
    .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" }, "ApiKey")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Taskora API running on http://localhost:${port}/api`);
}

void bootstrap();
