// src/core/reputation.ts

interface ReputationState {
  alpha: number; // Positive evidence (likes, etc.)
  beta: number;  // Negative evidence (reports, etc.)
}

export class ReputationManager {
  private state: Map<string, ReputationState> = new Map();

  private initializeUser(pubkey: string): void {
    if (!this.state.has(pubkey)) {
      this.state.set(pubkey, { alpha: 1, beta: 1 }); // Neutral prior (Beta(1,1))
    }
  }

  public getReputationScore(pubkey: string): number {
    this.initializeUser(pubkey);
    const { alpha, beta } = this.state.get(pubkey)!;
    return alpha / (alpha + beta); // Score in [0,1]
  }

  public recordLike(likedUserPubkey: string, likerPubkey: string): void {
    this.initializeUser(likedUserPubkey);
    this.initializeUser(likerPubkey);

    const likerRep = this.getReputationScore(likerPubkey);
    const increase = likerRep * 0.05; // 5% of liker's rep as positive signal
    const state = this.state.get(likedUserPubkey)!;
    state.alpha += increase;
    console.log(`[Reputation] +${increase.toFixed(4)} alpha for ${likedUserPubkey.slice(0,10)}... (liker rep: ${likerRep.toFixed(3)})`);
  }

  public recordReport(reportedUserPubkey: string, reporterPubkey: string, velocityMultiplier: number): void {
    this.initializeUser(reportedUserPubkey);
    this.initializeUser(reporterPubkey);

    const reporterRep = this.getReputationScore(reporterPubkey);
    const penalty = reporterRep * 10 * velocityMultiplier; // Base 10 * reporter rep * velocity
    const state = this.state.get(reportedUserPubkey)!;
    state.beta += penalty;
    console.log(`[Reputation] +${penalty.toFixed(4)} beta for ${reportedUserPubkey.slice(0,10)}... (reporter rep: ${reporterRep.toFixed(3)}, velocity: ${velocityMultiplier})`);
  }
}
