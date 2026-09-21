/*
  Warnings:

  - Added the required column `updated_at` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reviews" ("comment", "created_at", "id", "rating", "reservation_id", "service_id", "status", "user_id") SELECT "comment", "created_at", "id", "rating", "reservation_id", "service_id", "status", "user_id" FROM "reviews";
DROP TABLE "reviews";
ALTER TABLE "new_reviews" RENAME TO "reviews";
CREATE INDEX "reviews_service_id_idx" ON "reviews"("service_id");
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");
CREATE INDEX "reviews_status_idx" ON "reviews"("status");
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");
CREATE UNIQUE INDEX "reviews_user_id_service_id_key" ON "reviews"("user_id", "service_id");
CREATE TABLE "new_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meeting_point" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "duration_hours" REAL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rejection_reason" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "avg_rating" REAL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "services_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_services" ("category_id", "city_id", "created_at", "description", "duration_hours", "id", "is_featured", "latitude", "longitude", "meeting_point", "provider_id", "rejection_reason", "slug", "status", "title", "updated_at") SELECT "category_id", "city_id", "created_at", "description", "duration_hours", "id", "is_featured", "latitude", "longitude", "meeting_point", "provider_id", "rejection_reason", "slug", "status", "title", "updated_at" FROM "services";
DROP TABLE "services";
ALTER TABLE "new_services" RENAME TO "services";
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");
CREATE INDEX "services_provider_id_idx" ON "services"("provider_id");
CREATE INDEX "services_city_id_category_id_status_idx" ON "services"("city_id", "category_id", "status");
CREATE INDEX "services_is_featured_idx" ON "services"("is_featured");
CREATE INDEX "services_status_idx" ON "services"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
