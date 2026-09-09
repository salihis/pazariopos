import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma";

const ReceiptSettingsSchema = z.object({
  shopName: z.string().optional().default(""),
  shopPhone: z.string().optional().default(""),
  showTaxBreakdown: z.boolean().optional().default(true),
  showOrderNumber: z.boolean().optional().default(true),
  footerMessage: z.string().optional().default(""),
});

export async function registerReceiptSettingsRoutes(fastify: FastifyInstance) {
  // GET — Ayarları getir
  fastify.get("/api/receipt-settings", async (_request, reply) => {
    let settings = await prisma.receiptSettings.findFirst();

    // Eğer ayar yoksa varsayılan oluştur
    if (!settings) {
      settings = await prisma.receiptSettings.create({
        data: {
          shopName: "",
          shopPhone: "",
          showTaxBreakdown: true,
          showOrderNumber: true,
          footerMessage: "",
        },
      });
    }

    return reply.send(settings);
  });

  // POST — Ayarları kaydet
  fastify.post<{ Body: typeof ReceiptSettingsSchema._type }>(
    "/api/receipt-settings",
    async (request, reply) => {
      const body = ReceiptSettingsSchema.parse(request.body);

      // Varsa güncelle, yoksa oluştur
      let settings = await prisma.receiptSettings.findFirst();

      if (settings) {
        settings = await prisma.receiptSettings.update({
          where: { id: settings.id },
          data: body,
        });
      } else {
        settings = await prisma.receiptSettings.create({
          data: body,
        });
      }

      return reply.send(settings);
    }
  );
}