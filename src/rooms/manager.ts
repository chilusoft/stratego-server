import { ReversiRoom } from './room.js';

let seq = 0;

export class RoomManager {
  private rooms = new Map<string, ReversiRoom>();

  create(timePerPlayerMs?: number): ReversiRoom {
    const room = new ReversiRoom(`room-${++seq}`, timePerPlayerMs);
    this.rooms.set(room.id, room);
    return room;
  }

  get(id: string): ReversiRoom | undefined {
    return this.rooms.get(id);
  }

  /** Discovery: rooms waiting for a second player. */
  openRooms() {
    return [...this.rooms.values()]
      .filter((r) => r.isOpen)
      .map((r) => ({ id: r.id, players: r.snapshot().players }));
  }
}
