import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.API_CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Taskora API running on http://localhost:${port}/api`);
}

void bootstrap();
