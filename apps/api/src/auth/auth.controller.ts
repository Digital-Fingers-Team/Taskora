import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
  type AuthUser,
} from "@taskora/shared";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
