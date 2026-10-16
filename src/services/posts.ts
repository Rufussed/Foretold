import { API_BASE } from "./api";
import { getToken } from "./auth";

export const POST_MAX_LENGTH = 500;

export interface BoardPost {
  id: number;
  username: string;
  displayName: string;
  text: string;
  createdAt: string;
  canDelete: boolean;
}

export interface BoardPage {
  posts: BoardPost[];
  hasMore: boolean;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return new Error(data.error ?? fallback);
}

// Anyone can read the board; a token only adds the delete buttons.
export async function listPosts(beforeId?: number): Promise<BoardPage> {
  const query = beforeId === undefined ? "" : `?before=${beforeId}`;
  const response = await fetch(`${API_BASE}/posts${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await errorFrom(response, "Could not load the board");
  }

  return response.json() as Promise<BoardPage>;
}

export async function createPost(text: string): Promise<BoardPost> {
  const response = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw await errorFrom(response, "Could not post");
  }

  return response.json() as Promise<BoardPost>;
}

export async function deletePost(postId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await errorFrom(response, "Could not delete the post");
  }
}
