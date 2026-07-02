import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  KnowledgeSourceView,
  CreateKnowledgeSourceInput,
  KnowledgeSourceType,
} from "@taskora/shared";
import type { KnowledgeSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function toView(s: KnowledgeSource): KnowledgeSourceView {
  return {
    id: s.id,
    cardId: s.cardId,
    type: s.type as KnowledgeSourceType,
    title: s.title,
    url: s.url,
    content: s.content,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  /** بيتأكد إن الكارت بتاع المنظمة دي قبل أي عملية. */
  private async assertCard(organizationId: string, cardId: string): Promise<void> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
      select: { id: true },
    });
    if (!card) throw new NotFoundException("الكارت ده مش موجود");
  }

  async list(organizationId: string, cardId: string): Promise<KnowledgeSourceView[]> {
    await this.assertCard(organizationId, cardId);
    const sources = await this.prisma.knowledgeSource.findMany({
      where: { cardId },
      orderBy: { createdAt: "desc" },
    });
    return sources.map(toView);
  }

  async create(
    organizationId: string,
    cardId: string,
    actorId: string,
    input: CreateKnowledgeSourceInput,
  ): Promise<KnowledgeSourceView> {
    await this.assertCard(organizationId, cardId);
    const source = await this.prisma.knowledgeSource.create({
      data: {
        cardId,
        createdById: actorId,
        type: input.type,
        title: input.title,
        url: input.url ?? null,
        content: input.content,
      },
    });
    return toView(source);
  }

  async remove(
    organizationId: string,
    cardId: string,
    id: string,
  ): Promise<{ removed: true }> {
    await this.assertCard(organizationId, cardId);
    const source = await this.prisma.knowledgeSource.findFirst({ where: { id, cardId } });
    if (!source) throw new NotFoundException("المصدر ده مش موجود");
    await this.prisma.knowledgeSource.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * استرجاع للـ RAG — بيرجّع أعلى المصادر صلة بالاستعلام.
   * ترتيب بدائي بتطابق الكلمات (lexical) دلوقتي؛ الـ seam جاهز لاستبداله
   * بتضمين متجهي (pgvector) لما مزوّد التضمين يتوصّل. الموقّعون: Tasks/AiService.
   */
  async retrieve(cardId: string, query: string, limit = 3): Promise<KnowledgeSourceView[]> {
    const sources = await this.prisma.knowledgeSource.findMany({ where: { cardId } });
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (terms.length === 0) return sources.slice(0, limit).map(toView);

    const scored = sources.map((s) => {
      const haystack = `${s.title} ${s.content}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
      return { s, score };
    });
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => toView(x.s));
  }
}
