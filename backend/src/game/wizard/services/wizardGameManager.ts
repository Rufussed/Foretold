import type { Room } from "../models/wizardGame.js";

class WizardGameManager {
  private rooms: Room[] = [];

  getRooms(): Room[] {
    return this.rooms;
  }

  createRoom(name: string): Room {
    const room: Room = {
      id: `room-${Date.now()}`,
      name,
      maxPlayers: 4,
      players: [],
      status: "waiting",
    };

    this.rooms.push(room);
    return room;
  }

  joinRoom(roomId: string, username: string): Room | null {
    const room = this.rooms.find((r) => r.id === roomId);

    if (!room) return null;
    if (room.players.includes(username)) return room;
    if (room.players.length >= room.maxPlayers) return null;

    room.players.push(username);
    return room;
  }
}

export const wizardGameManager = new WizardGameManager();