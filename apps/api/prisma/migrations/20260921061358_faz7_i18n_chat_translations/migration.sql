-- CreateTable
CREATE TABLE "service_translations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meeting_point" TEXT,
    CONSTRAINT "service_translations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "last_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "service_translations_service_id_idx" ON "service_translations"("service_id");

-- CreateIndex
CREATE INDEX "service_translations_locale_idx" ON "service_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "service_translations_service_id_locale_key" ON "service_translations"("service_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_reservation_id_key" ON "conversations"("reservation_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_provider_id_idx" ON "conversations"("provider_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_is_read_idx" ON "messages"("is_read");
