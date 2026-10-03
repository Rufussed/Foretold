import { UserService } from "../../../services/userService.js";
import {
  friendRequestRepository,
  type Friend,
  type FriendRequest,
} from "./friendRequestRepository.js";

class FriendService {
  sendRequest(senderId: number, receiverId: number): boolean {
    const receiver = UserService.getUserById(receiverId);

    if (!receiver) {
      return false;
    }

    if (senderId === receiverId) {
      return false;
    }

    return friendRequestRepository.sendRequest(
      senderId,
      receiverId,
    );
  }

  getFriends(userId: number): Friend[] {
    return friendRequestRepository.getFriends(userId);
  }

  getPendingRequests(userId: number): FriendRequest[] {
    return friendRequestRepository.getPendingRequests(userId);
  }

  acceptRequest(requestId: number, userId: number): boolean {
    return friendRequestRepository.acceptRequest(
      requestId,
      userId,
    );
  }

  rejectRequest(requestId: number, userId: number): boolean {
    return friendRequestRepository.rejectRequest(
      requestId,
      userId,
    );
  }

  removeFriend(userId: number, friendId: number): boolean {
    return friendRequestRepository.removeFriend(
      userId,
      friendId,
    );
  }

  getRelationshipStatus(userId: number, otherUserId: number) {
    return friendRequestRepository.getRelationshipStatus(
      userId,
      otherUserId,
    );
  }
}

export const friendService = new FriendService();