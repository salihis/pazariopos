import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma";

// Her alan gerçekten opsiyonel — .default(...) YOK. POST bir kısmi
// güncelleme (client her seferinde sadece değişen tek alanı gönderir),
// tam bir replace değil. .default() kullanılsaydı, gönderilmeyen her
// alan varsayılana sıfırlanıp diğer kayıtlı alanları ezerdi.
const ReceiptSettingsSchema = z.object({
  shopName: z.string().optional(),
  shopPhone: z.string().optional(),
  showTaxBreakdown: z.boolean().optional(),
  showOrderNumber: z.boolean().optional(),
  footerMessage: z.string().optional(),
});

export async function registerReceiptSettingsRoutes(fastify: FastifyInstance) {
  // GET — Ayarları getir
  fastify.get("/", async (_request, reply) => {
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

  // POST — Ayarları kaydet (kısmi güncelleme)
  fastify.post<{ Body: typeof ReceiptSettingsSchema._type }>(
    "/",
    async (request, reply) => {
      const body = ReceiptSettingsSchema.parse(request.body);

      // Sadece isteğin gerçekten içerdiği alanları güncelle — undefined
      // olan (yani hiç gönderilmemiş) alanları prisma.update'e vermiyoruz,
      // aksi halde o alanlar mevcut değerlerinin üzerine "boş"/varsayılan
      // yazılırdı.
      const data = Object.fromEntries(
        Object.entries(body).filter(([, value]) => value !== undefined)
      );

      let settings = await prisma.receiptSettings.findFirst();

      if (settings) {
        settings = await prisma.receiptSettings.update({
          where: { id: settings.id },
          data,
        });
      } else {
        settings = await prisma.receiptSettings.create({
          data: {
            shopName: "",
            shopPhone: "",
            showTaxBreakdown: true,
            showOrderNumber: true,
            footerMessage: "",
            ...data,
          },
        });
      }

      return reply.send(settings);
    }
  );
}