import db from "../../../db/database.js";
export interface Friend {
  playerId: number;
  username: string;
  displayName: string;
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

class FriendRequestRepository {
    sendRequest(senderId: number, receiverId: number): boolean {
    if (senderId === receiverId) {
        return false;
    }

    const existing = db.prepare(`
        SELECT id, sender_id AS senderId, receiver_id AS receiverId, status
        FROM friend_requests
        WHERE
        (sender_id = ? AND receiver_id = ?)
        OR
        (sender_id = ? AND receiver_id = ?)
    `).get(
        senderId,
        receiverId,
        receiverId,
        senderId,
    ) as {
        id: number;
        senderId: number;
        receiverId: number;
        status: "pending" | "accepted" | "rejected";
    } | undefined;

    if (existing?.status === "pending") {
        return false;
    }

    if (existing?.status === "accepted") {
        return false;
    }

    if (existing?.status === "rejected") {
        db.prepare(`
        UPDATE friend_requests
        SET
            sender_id = ?,
            receiver_id = ?,
            status = 'pending',
            created_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `).run(
        senderId,
        receiverId,
        existing.id,
        );

        return true;
    }

    db.prepare(`
        INSERT INTO friend_requests (
        sender_id,
        receiver_id,
        status
        )
        VALUES (?, ?, 'pending')
    `).run(senderId, receiverId);

    return true;
    }
  getPendingRequests(userId: number): FriendRequest[] {
    const rows = db.prepare(`
      SELECT
        fr.id,
        fr.sender_id AS senderId,
        fr.receiver_id AS receiverId,
        fr.status,
        fr.created_at AS createdAt
      FROM friend_requests fr
      WHERE fr.receiver_id = ?
        AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(userId) as FriendRequest[];
  
    return rows;
  }

  acceptRequest(requestId: number, userId: number): boolean {
    const result = db.prepare(`
        UPDATE friend_requests
        SET status = 'accepted'
        WHERE id = ?
        AND receiver_id = ?
        AND status = 'pending'
    `).run(requestId, userId);

    return result.changes > 0;
    }

  rejectRequest(requestId: number, userId: number): boolean {
    const result = db.prepare(`
        UPDATE friend_requests
        SET status = 'rejected'
        WHERE id = ?
        AND receiver_id = ?
        AND status = 'pending'
    `).run(requestId, userId);

    return result.changes > 0;
    }

    getFriends(userId: number): Friend[] {
    const rows = db.prepare(`
        SELECT
        CASE
            WHEN fr.sender_id = ? THEN fr.receiver_id
            ELSE fr.sender_id
        END AS playerId,

        u.username,
        u.display_name AS displayName

        FROM friend_requests fr

        JOIN users u
        ON u.id = CASE
            WHEN fr.sender_id = ? THEN fr.receiver_id
            ELSE fr.sender_id
        END

        WHERE
        (fr.sender_id = ? OR fr.receiver_id = ?)
        AND fr.status = 'accepted'

        ORDER BY u.display_name COLLATE NOCASE ASC
    `).all(
        userId,
        userId,
        userId,
        userId,
    ) as Friend[];

    return rows;
    }

    removeFriend(userId: number, friendId: number): boolean {
    const result = db.prepare(`
        DELETE FROM friend_requests
        WHERE status = 'accepted'
        AND (
            (sender_id = ? AND receiver_id = ?)
            OR
            (sender_id = ? AND receiver_id = ?)
        )
    `).run(
        userId,
        friendId,
        friendId,
        userId,
    );

    return result.changes > 0;
    }
}


export const friendRequestRepository =
  new FriendRequestRepository();