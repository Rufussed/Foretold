// The game socket carries the player's session token in its address
// (?token=..., src/services/gameSocket.ts), and the server log writes every
// request's address. Whoever reads the log could sign in as that player, so
// the token's value is blanked before the line is written (server.ts).
export function addressForLog(url: string): string {
  return url.replace(/([?&]token=)[^&]*/gi, "$1[hidden]");
}
