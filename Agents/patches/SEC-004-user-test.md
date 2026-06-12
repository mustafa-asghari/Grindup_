# User Test Instructions: SEC-004

## What was fixed

Contest and lobby chat endpoints now require the caller to be the creator/host or a participant before reading or posting messages. Chat responses should no longer include sender email addresses.

## Where to test

- API endpoint: `GET /api/contests/<contestId>/messages`
- API endpoint: `POST /api/contests/<contestId>/messages`
- API endpoint: `GET /api/contests/lobbies/<lobbyId>/messages`
- API endpoint: `POST /api/contests/lobbies/<lobbyId>/messages`
- Browser page: contest/lobby chat UI, if available locally

## Setup needed

Run the web app locally and use one session for a contest/lobby participant or creator and one authenticated session for a non-participant.

## Test steps

1. With the non-participant session, call `GET /api/contests/<contestId>/messages`.
2. With the non-participant session, call `POST /api/contests/lobbies/<lobbyId>/messages` with JSON body `{"message":"unauthorized hello"}`.
3. With a participant or creator session, open the same chat and send a normal message.
4. Inspect the successful JSON responses for each message sender object.

## Expected result

Non-participant GET and POST requests return `403 Forbidden`. Participant or creator requests succeed, and returned sender objects include public profile fields such as `id`, `name`, and `image` but no `email`.

## Bad result

The fix failed if a non-participant can read or post chat messages, or if any chat response includes a sender email address.

## Regression checks

Participants can still load chat history and post messages. Contest/lobby creators can still use chat.

## What to tell the AI after testing

If the test passed, say:

`I tested task SEC-004 and approve it.`

If the test failed, say:

`Task SEC-004 failed user testing. Here is what happened: <details>.`
