-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'VET', 'HERDSMAN', 'MILKER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalOrigin" AS ENUM ('BORN_ON_FARM', 'PURCHASED');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('CALF', 'HEIFER', 'COW', 'DRY', 'SOLD', 'DEAD', 'SLAUGHTERED');

-- CreateEnum
CREATE TYPE "BreedingState" AS ENUM ('FRESH', 'VOLUNTARY_WAIT', 'OPEN', 'IN_HEAT', 'INSEMINATED', 'PREGNANT', 'CLOSE_TO_CALVING', 'DRY', 'CULLED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('SALE', 'DEATH', 'SLAUGHTER');

-- CreateEnum
CREATE TYPE "BreedingEventType" AS ENUM ('HEAT_OBSERVED', 'SYNCHRONIZATION_STEP', 'INSEMINATION', 'PREGNANCY_CHECK', 'CALVING', 'DRY_OFF', 'ABORTION');

-- CreateEnum
CREATE TYPE "BreedingEventResult" AS ENUM ('POSITIVE', 'NEGATIVE', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "CalvingType" AS ENUM ('NORMAL', 'ASSISTED', 'CAESAREAN');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('POSTPARTUM_CHECK', 'READY_TO_BREED', 'OPEN_TOO_LONG', 'IN_HEAT', 'MISSED_HEAT', 'PREGNANCY_CHECK_DUE', 'PREGNANCY_CHECK_OVERDUE', 'DRY_OFF_DUE', 'CLOSE_TO_CALVING');

-- CreateEnum
CREATE TYPE "AlertUrgency" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "address" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "barnName" TEXT NOT NULL,
    "stallName" TEXT,
    "capacity" INTEGER,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameters" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "voluntaryWaitDays" INTEGER NOT NULL DEFAULT 50,
    "openTooLongDays" INTEGER NOT NULL DEFAULT 75,
    "postpartumCheckDay" INTEGER NOT NULL DEFAULT 12,
    "heatWindowHours" INTEGER NOT NULL DEFAULT 18,
    "pregnancyCheckDays" INTEGER NOT NULL DEFAULT 32,
    "confirmatoryCheckDays" INTEGER NOT NULL DEFAULT 60,
    "gestationLengthDays" INTEGER NOT NULL DEFAULT 280,
    "dryOffOffsetDays" INTEGER NOT NULL DEFAULT 60,
    "closeToCalvingOffsetDays" INTEGER NOT NULL DEFAULT 21,

    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "earTag" TEXT NOT NULL,
    "transponderId" TEXT,
    "name" TEXT,
    "breed" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "origin" "AnimalOrigin" NOT NULL,
    "damId" TEXT,
    "sireId" TEXT,
    "sireStrawRef" TEXT,
    "status" "AnimalStatus" NOT NULL DEFAULT 'CALF',
    "locationId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitDate" TIMESTAMP(3),
    "exitReason" "ExitReason",
    "breedingState" "BreedingState" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "breedingStateSince" TIMESTAMP(3),
    "lactationState" TEXT,
    "lactationNumber" INTEGER NOT NULL DEFAULT 0,
    "currentLactationStart" TIMESTAMP(3),
    "lastCalvingDate" TIMESTAMP(3),
    "lastInseminationDate" TIMESTAMP(3),
    "expectedCalvingDate" TIMESTAMP(3),
    "heatWindowExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeding_events" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "BreedingEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "semenOrSireRef" TEXT,
    "operatorId" TEXT,
    "result" "BreedingEventResult",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeding_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calving_details" (
    "id" TEXT NOT NULL,
    "breedingEventId" TEXT NOT NULL,
    "calfAnimalId" TEXT,
    "calvingType" "CalvingType" NOT NULL,
    "problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "birthWeightKg" DOUBLE PRECISION,
    "isTwin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "calving_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "animalId" TEXT,
    "type" "AlertType" NOT NULL,
    "urgency" "AlertUrgency" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_farmId_email_key" ON "users"("farmId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "system_parameters_farmId_key" ON "system_parameters"("farmId");

-- CreateIndex
CREATE INDEX "animals_farmId_breedingState_idx" ON "animals"("farmId", "breedingState");

-- CreateIndex
CREATE UNIQUE INDEX "animals_farmId_earTag_key" ON "animals"("farmId", "earTag");

-- CreateIndex
CREATE INDEX "breeding_events_animalId_eventDate_idx" ON "breeding_events"("animalId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "calving_details_breedingEventId_key" ON "calving_details"("breedingEventId");

-- CreateIndex
CREATE INDEX "alerts_animalId_type_status_idx" ON "alerts"("animalId", "type", "status");

-- CreateIndex
CREATE INDEX "alerts_status_urgency_idx" ON "alerts"("status", "urgency");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_parameters" ADD CONSTRAINT "system_parameters_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_damId_fkey" FOREIGN KEY ("damId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_details" ADD CONSTRAINT "calving_details_breedingEventId_fkey" FOREIGN KEY ("breedingEventId") REFERENCES "breeding_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_details" ADD CONSTRAINT "calving_details_calfAnimalId_fkey" FOREIGN KEY ("calfAnimalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
