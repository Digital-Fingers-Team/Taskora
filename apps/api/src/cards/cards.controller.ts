import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  OrgRole,
  createCardSchema,
  updateCardSchema,
  updateCardVisibilitySchema,
  runCardSimulationSchema,
  type CreateCardInput,
  type UpdateCardInput,
  type UpdateCardVisibilityInput,
  type RunCardSimulationInput,
  type AuthUser,
} from "@taskora/shared";
import { CardSimulationsService } from "./card-simulations.service";
import { CardsService } from "./cards.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/cards")
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly simulations: CardSimulationsService,
  ) {}

  @RequireRole(OrgRole.Member)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.cards.list(orgId);
  }

  @RequireRole(OrgRole.Member)
  @Get(":cardId")
  get(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.cards.get(orgId, cardId);
  }

  @RequireRole(OrgRole.Member)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCardSchema)) body: CreateCardInput,
  ) {
    return this.cards.create(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Patch(":cardId")
  update(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateCardSchema)) body: UpdateCardInput,
  ) {
    return this.cards.update(orgId, cardId, user.id, body);
  }

  @RequireRole(OrgRole.Admin)
  @Delete(":cardId")
  remove(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cards.remove(orgId, cardId, user.id);
  }

  // --- المرحلة 9 (السوق والجودة) ---

  @RequireRole(OrgRole.Admin)
  @Patch(":cardId/visibility")
  updateVisibility(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateCardVisibilitySchema)) body: UpdateCardVisibilityInput,
  ) {
    return this.cards.updateVisibility(orgId, cardId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Post(":cardId/simulations")
  runSimulation(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(runCardSimulationSchema)) body: RunCardSimulationInput,
  ) {
    return this.simulations.run(orgId, cardId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Get(":cardId/simulations")
  listSimulations(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.simulations.list(orgId, cardId);
  }

  @RequireRole(OrgRole.Member)
  @Get(":cardId/simulations/:id")
  getSimulation(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Param("id") id: string,
  ) {
    return this.simulations.get(orgId, cardId, id);
  }
}
