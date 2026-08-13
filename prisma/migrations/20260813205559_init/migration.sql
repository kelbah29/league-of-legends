-- CreateTable
CREATE TABLE "Player" (
    "puuid" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "tagLine" TEXT NOT NULL,
    "platformRegion" TEXT NOT NULL,
    "profileIconId" INTEGER NOT NULL,
    "summonerLevel" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("puuid")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "playerPuuid" TEXT NOT NULL,
    "queueType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "leaguePoints" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "matchId" TEXT NOT NULL,
    "gameCreation" BIGINT NOT NULL,
    "gameDuration" INTEGER NOT NULL,
    "gameVersion" TEXT NOT NULL,
    "queueId" INTEGER NOT NULL,
    "platformId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "MatchTimeline" (
    "matchId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTimeline_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "AiCoachSummary" (
    "puuid" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "basedOnMatchCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCoachSummary_pkey" PRIMARY KEY ("puuid")
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "puuid" TEXT NOT NULL,
    "championName" TEXT NOT NULL,
    "teamPosition" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "cs" INTEGER NOT NULL,
    "goldEarned" INTEGER NOT NULL,
    "totalDamageDealtToChampions" INTEGER NOT NULL,
    "visionScore" INTEGER NOT NULL,
    "champExperience" INTEGER NOT NULL,
    "wardsPlaced" INTEGER NOT NULL,
    "wardsKilled" INTEGER NOT NULL,
    "killParticipation" DOUBLE PRECISION NOT NULL,
    "dragonTakedowns" INTEGER NOT NULL,
    "baronTakedowns" INTEGER NOT NULL,
    "turretTakedowns" INTEGER NOT NULL,
    "riftHeraldTakedowns" INTEGER NOT NULL,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_gameName_tagLine_platformRegion_key" ON "Player"("gameName", "tagLine", "platformRegion");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_playerPuuid_queueType_key" ON "Rank"("playerPuuid", "queueType");

-- CreateIndex
CREATE INDEX "MatchParticipant_puuid_idx" ON "MatchParticipant"("puuid");

-- CreateIndex
CREATE INDEX "MatchParticipant_championName_teamPosition_idx" ON "MatchParticipant"("championName", "teamPosition");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_puuid_key" ON "MatchParticipant"("matchId", "puuid");

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_playerPuuid_fkey" FOREIGN KEY ("playerPuuid") REFERENCES "Player"("puuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTimeline" ADD CONSTRAINT "MatchTimeline_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("matchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("matchId") ON DELETE CASCADE ON UPDATE CASCADE;
