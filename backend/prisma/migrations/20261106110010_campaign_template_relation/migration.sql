-- AddForeignKey
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
