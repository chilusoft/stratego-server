/** Tracks active player names so no two live players share a name. */
export class NameRegistry {
  private byName = new Map<string, string>(); // lower(name) -> playerId

  /** Returns true if the name is free (or already owned by same id). */
  claim(name: string, playerId: string): boolean {
    const key = name.trim().toLowerCase();
    if (!key) return false;
    const owner = this.byName.get(key);
    if (owner && owner !== playerId) return false;
    this.byName.set(key, playerId);
    return true;
  }

  release(name: string, playerId: string): void {
    const key = name.trim().toLowerCase();
    if (this.byName.get(key) === playerId) this.byName.delete(key);
  }

  displayName(name: string): string {
    return name.trim();
  }
}
