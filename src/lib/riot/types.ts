export interface RiotAccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface LeagueEntryDto {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ParticipantChallengesDto {
  killParticipation?: number;
  dragonTakedowns?: number;
  baronTakedowns?: number;
  turretTakedowns?: number;
  riftHeraldTakedowns?: number;
}

export interface ParticipantDto {
  puuid: string;
  championName: string;
  teamPosition: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  champExperience: number;
  wardsPlaced: number;
  wardsKilled: number;
  challenges?: ParticipantChallengesDto;
}

export interface TimelineEventDto {
  type: string;
  timestamp: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  monsterType?: string;
  buildingType?: string;
  towerType?: string;
  laneType?: string;
  creatorId?: number;
  participantId?: number;
}

export interface PositionDto {
  x: number;
  y: number;
}

export interface ParticipantFrameDto {
  participantId: number;
  position?: PositionDto;
}

export interface TimelineFrameDto {
  timestamp: number;
  events: TimelineEventDto[];
  participantFrames?: Record<string, ParticipantFrameDto>;
}

export interface MatchTimelineDto {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    frameInterval: number;
    frames: TimelineFrameDto[];
  };
}

export interface MatchDto {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameVersion: string;
    queueId: number;
    platformId: string;
    participants: ParticipantDto[];
  };
}
