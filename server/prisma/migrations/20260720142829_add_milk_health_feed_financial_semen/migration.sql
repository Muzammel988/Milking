-- CreateEnum
CREATE TYPE "MilkSession" AS ENUM ('MORNING', 'MIDDAY', 'EVENING');

-- CreateEnum
CREATE TYPE "LactationCycleState" AS ENUM ('FRESH', 'PEAK', 'MID_LACTATION', 'LATE_LACTATION', 'DRY');

-- CreateEnum
CREATE TYPE "HealthEventType" AS ENUM ('EXAMINATION', 'DIAGNOSIS', 'TREATMENT', 'VACCINATION');

-- CreateEnum
CREATE TYPE "RationTargetGroup" AS ENUM ('LACTATING', 'DRY', 'HEIFER', 'CALF');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('MILK_SALE', 'FEED_PURCHASE', 'VET_COST', 'INSEMINATION_COST', 'ANIMAL_PURCHASE', 'ANIMAL_SALE', 'LABOR', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'YIELD_DROP';
ALTER TYPE "AlertType" ADD VALUE 'MISSING_MILK_DATA';
ALTER TYPE "AlertType" ADD VALUE 'LOW_FEED_STOCK';

-- AlterTable
ALTER TABLE "animals" DROP COLUMN "lactationState",
ADD COLUMN     "lactationState" "LactationCycleState";

-- AlterTable
ALTER TABLE "breeding_events" ADD COLUMN     "semenStrawId" TEXT;

-- AlterTable
ALTER TABLE "system_parameters" ADD COLUMN     "colostrumDays" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "freshLactationDays" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "midLactationDays" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "missingMilkDataDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "peakLactationDays" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "targetDryOffDim" INTEGER NOT NULL DEFAULT 305,
ADD COLUMN     "yieldDropThresholdPct" INTEGER NOT NULL DEFAULT 18;

-- CreateTable
CREATE TABLE "milk_records" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "session" "MilkSession" NOT NULL,
    "yieldLiters" DOUBLE PRECISION NOT NULL,
    "fatPct" DOUBLE PRECISION,
    "proteinPct" DOUBLE PRECISION,
    "somaticCellCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milk_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lactation_cycles" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "colostrumEndDate" TIMESTAMP(3) NOT NULL,
    "state" "LactationCycleState" NOT NULL DEFAULT 'FRESH',
    "peakYield" DOUBLE PRECISION,
    "totalYield" DOUBLE PRECISION,
    "avgDailyYield" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lactation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultWithdrawalPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccines" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultWithdrawalPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_events" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "HealthEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "medicineId" TEXT,
    "vaccineId" TEXT,
    "dosage" TEXT,
    "cost" DOUBLE PRECISION,
    "operatorId" TEXT,
    "notes" TEXT,
    "withdrawalPeriodDays" INTEGER,
    "withdrawalEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_ingredients" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "feed_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ration_formulas" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetGroup" "RationTargetGroup" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ration_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ration_formula_ingredients" (
    "id" TEXT NOT NULL,
    "rationFormulaId" TEXT NOT NULL,
    "feedIngredientId" TEXT NOT NULL,
    "quantityPerHeadPerDay" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ration_formula_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_consumption_records" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "rationFormulaId" TEXT NOT NULL,
    "animalId" TEXT,
    "groupLabel" TEXT,
    "headCount" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_consumption_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "animalId" TEXT,
    "animalGroupLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semen_straws" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sireName" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "strawIdentifier" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "costPerStraw" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "semen_straws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milk_records_animalId_recordDate_idx" ON "milk_records"("animalId", "recordDate");

-- CreateIndex
CREATE INDEX "milk_records_farmId_recordDate_idx" ON "milk_records"("farmId", "recordDate");

-- CreateIndex
CREATE INDEX "lactation_cycles_animalId_state_idx" ON "lactation_cycles"("animalId", "state");

-- CreateIndex
CREATE INDEX "health_events_animalId_eventDate_idx" ON "health_events"("animalId", "eventDate");

-- CreateIndex
CREATE INDEX "feed_consumption_records_farmId_date_idx" ON "feed_consumption_records"("farmId", "date");

-- CreateIndex
CREATE INDEX "financial_transactions_farmId_date_idx" ON "financial_transactions"("farmId", "date");

-- CreateIndex
CREATE INDEX "financial_transactions_animalId_idx" ON "financial_transactions"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "semen_straws_strawIdentifier_key" ON "semen_straws"("strawIdentifier");

-- AddForeignKey
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_semenStrawId_fkey" FOREIGN KEY ("semenStrawId") REFERENCES "semen_straws"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_records" ADD CONSTRAINT "milk_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_records" ADD CONSTRAINT "milk_records_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lactation_cycles" ADD CONSTRAINT "lactation_cycles_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccines" ADD CONSTRAINT "vaccines_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_ingredients" ADD CONSTRAINT "feed_ingredients_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ration_formulas" ADD CONSTRAINT "ration_formulas_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ration_formula_ingredients" ADD CONSTRAINT "ration_formula_ingredients_rationFormulaId_fkey" FOREIGN KEY ("rationFormulaId") REFERENCES "ration_formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ration_formula_ingredients" ADD CONSTRAINT "ration_formula_ingredients_feedIngredientId_fkey" FOREIGN KEY ("feedIngredientId") REFERENCES "feed_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_consumption_records" ADD CONSTRAINT "feed_consumption_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_consumption_records" ADD CONSTRAINT "feed_consumption_records_rationFormulaId_fkey" FOREIGN KEY ("rationFormulaId") REFERENCES "ration_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_consumption_records" ADD CONSTRAINT "feed_consumption_records_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semen_straws" ADD CONSTRAINT "semen_straws_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

