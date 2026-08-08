# Google Maps Entity List RPC Reconnaissance

Capture date: 2026-08-08  
Browser: Chrome 151.0.7922.76 over CDP at `127.0.0.1:9222`  
Viewport: forced before navigation with `Emulation.setDeviceMetricsOverride`, `1600x1000`, `deviceScaleFactor:1`, `mobile:false`

## Verdicts

1. **Per-place mobile tags are not present in the web list payload.** I searched the raw `/maps/preview/entitylist/getlist` response and parsed JSON paths for the exact strings `For food`, `For snack`, `For drinks`, `To see`, and `To shop`. None appeared in `getlist`. `To see` appeared only in downloaded Maps JavaScript bundles, not in any list or place data payload.
2. **There is a usable web write RPC for adding/removing a place from a list.** The web client uses GET endpoints under `/maps/preview/entitylist/`: `createitem` for save and `deleteitem` for remove. Cookies provide account identity, and the `pb=` payload includes a page-bootstrapped anti-CSRF-style token at `!4s...`.
3. **No tag write RPC was observed.** During save, remove, list open, list scroll, and place detail load, no sibling endpoint or request containing tag fields/tag names appeared. Tagging looks app-only from this web capture.

## Desktop UI Check

Google Maps loaded the desktop UI at `1600x1000`: left rail, top search box, and left-hand content panel were visible. The list was opened through UI navigation: `Saved -> Malaysia spots`; no deep link was used.

## Captured Endpoints

### Read list

Endpoint:

```text
GET https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=sg&pb=<PB>
```

Captured `pb`:

```text
!1m4
  !1sN3TXaFK_Qv2UJuVFxHygyQ     # list id
  !2e1
  !3m1!1e1
!2e2
!3e3
!4i500                          # requested page size
!6m3
  !1sD7x2aqP4J63z4-EPgZC14QQ     # session/page token
  !7e81
  !28e2
!8i3
!16b1
```

This confirms the read endpoint is still `/maps/preview/entitylist/getlist`. In this capture the web client requested `500` entries and the response contained all 314 places, so no pagination cursor was emitted or reused. Scrolling expanded the DOM and triggered rendering/network activity, but no second `getlist` was needed.

### Save place to list

Endpoint:

```text
GET https://www.google.com/maps/preview/entitylist/createitem?authuser=0&hl=en&gl=sg&pb=<PB>
```

Captured operation: `Singapore Flyer` saved to `Want to go`, then reverted.

Important `pb` fields:

```text
!1m6
  !1s1iYjorstwvvrX_3T6TuqJ_ilnQpY      # target list id: Want to go
  !2e3
  !3m1!1e1
  !3m1!1e9
!2m14
  !2m6
    !6m2!3d1.2892987999999999!4d103.86313679999999
    !7m2!1y3592211867340460493!2y9202232323147137646
  !3sSingapore Flyer
  !9m5
    !1m1!1e1
    !2m2!1y3592211867340460493!2y9202232323147137646
!3m6
  !1sD7x2aqP4J63z4-EPgZC14QQ:2669
  !2s1i:22,t:39793,e:21,p:D7x2aqP4J63z4-EPgZC14QQ:2669
  !4m1!2i39793
  !7e81
  !28e2
!4sAMAbHII...:<timestamp>              # page-sourced write token, redacted
```

Response:

```text
)]}'
[]
```

### Remove place from list

Endpoint:

```text
GET https://www.google.com/maps/preview/entitylist/deleteitem?authuser=0&hl=en&gl=sg&pb=<PB>
```

The remove `pb` used the same list id, place coordinates, place id tuple, and place title. The contextual event subsegment changed, and `!4s` carried a different page-sourced token.

Response excerpt:

```json
)]}'
[[[null,[null,null,null,null,null,[null,null,1.2892987999999999,103.86313679999999],["3592211867340460493","9202232323147137646"]],"Singapore Flyer",null,null,null,null,null,[[1],["3592211867340460493","9202232323147137646"]]]]]
```

## Auth Material

Observed request headers for `getlist`, `createitem`, and `deleteitem` contained no explicit `Authorization`, `SAPISIDHASH`, `X-Goog-*`, or custom CSRF header in CDP. The calls relied on browser cookies plus query payload data.

The write calls include a token in `pb`:

```text
!4sAMAbHII...:<timestamp>
```

The token prefix was present in the initial `/maps` document response before the write, then reused in the `createitem` URL. That makes the write RPC replayable only if a caller can first load/parse a fresh authenticated Maps page and supply the current token plus cookies.

## `getlist` Response Shape

The response is anti-XSSI JSON:

```text
)]}'
[
  [ ... list block ... ],
  ...
]
```

Top-level populated fields:

| Path | Meaning |
| --- | --- |
| `$[0]` | Main list block |
| `$[0][0]` | List identity tuple: `[listId, visibility/type flags...]` |
| `$[0][2]` | Share/link metadata, including canonical list URL and tokenized URL |
| `$[0][3]` | Owner profile `[name, avatarUrl, accountId]` |
| `$[0][4]` | List title, `Malaysia spots` |
| `$[0][5]` | List description |
| `$[0][8]` | Place entries array, length `314` |
| `$[0][10]` | List created timestamp tuple `[seconds, nanos]` |
| `$[0][11]` | List updated timestamp tuple `[seconds, nanos]` |
| `$[0][12]` | Place count, `314` |
| `$[0][13]` | List/share mode enum, observed `3` |
| `$[0][14]` | Collaborators array |
| `$[0][17]` | List emoji/icon, `🇲🇾` |
| `$[0][20]` | Report URL |

## Place Entry Index Map

For entries under `$[0][8][n]`, populated indexes across the 314 places were:

| Index | Count | Meaning |
| --- | ---: | --- |
| `[1]` | 314 | Place core/location metadata |
| `[2]` | 314 | Display name |
| `[3]` | 79 | User note text, e.g. `Visited`, `Butter`, `Dim sum` |
| `[8]` | 314 | Saved/list item identity tuple: `[[1],[featureId0, featureId1]]` |
| `[9]` | 314 | Added/created timestamp tuple `[seconds, nanos]` |
| `[10]` | 314 | Updated timestamp tuple `[seconds, nanos]` |
| `[12]` | 314 | Contributor profile `[name, avatarUrl, accountId]` |
| `[15]` | 79 | Note author profile array, present when `[3]` note exists |
| `[19]` | 210 | Opaque item token array, e.g. `[[FMREF...]]` |

No entries had populated `[0]`, `[4]`, `[5]`, `[6]`, `[7]`, `[11]`, `[13]`, `[14]`, `[16]`, `[17]`, or `[18]` in this capture.

### Place Core Metadata: `[1]`

For `$[0][8][n][1]`:

| Index | Count | Meaning |
| --- | ---: | --- |
| `[1][2]` | 293 | Full place/address label |
| `[1][4]` | 299 | Postal/street address |
| `[1][5]` | 314 | Coordinate tuple; latitude at `[1][5][2]`, longitude at `[1][5][3]` |
| `[1][6]` | 314 | Google feature/place id tuple |
| `[1][7]` | 300 | Knowledge graph / feature id string, e.g. `/g/11z8k42n7f` |

Fourteen entries had `[1]` length 7 and no `[1][7]` string; these still carried coordinates and the two-part feature id tuple.

## Tag Search Evidence

Exact tag strings searched:

```text
For food
For snack
For drinks
To see
To shop
```

Results:

| Tag | In `getlist` raw body | Parsed JSON path hits | Other captured hits |
| --- | --- | --- | --- |
| `For food` | No | None | None |
| `For snack` | No | None | None |
| `For drinks` | No | None | None |
| `To see` | No | None | Maps JS bundles only |
| `To shop` | No | None | None |

There is no per-place tag array and no list-level tag registry in the captured web `getlist` payload.

## Raw Samples, Redacted

Read response opening:

```json
)]}'
[[["N3TXaFK_Qv2UJuVFxHygyQ",1,null,1,1],2,[3,1,"https://www.google.com/maps/placelists/list/N3TXaFK_Qv2UJuVFxHygyQ","https://www.google.com/maps/placelists/list/N3TXaFK_Qv2UJuVFxHygyQ?token=<REDACTED>"],["Jasmine Seah","https://lh3.googleusercontent.com/a/<REDACTED>","<ACCOUNT_ID_REDACTED>"],"Malaysia spots","Hello and welcome! ...",null,null,[
  [null,[null,null,"Lot L1-078, DUDU DUCK CAFE, Tasek Central Mall, 2, Jalan Pendekar 16, Taman Ungku Tun Aminah, 81300 Skudai, Johor Darul Ta'zim, Malaysia",null,"Lot L1-078, Tasek Central Mall, 2, Jalan Pendekar 16, Taman Ungku Tun Aminah, 81300 Skudai, Johor Darul Ta'zim, Malaysia",[null,null,1.5140387,103.65518039999999],["3592311145746771111","3125426341002024374"],"/g/11z8k42n7f"],"DUDU DUCK CAFE","",null,null,null,[],[[1],["3592311145746771111","3125426341002024374"]],[1786159254,396798000],[1786159254,396798000],null,["<ACCOUNT_NAME_REDACTED>","https://lh3.googleusercontent.com/a-/<REDACTED>","<ACCOUNT_ID_REDACTED>"],null,null,null,null,null,null,[["FMREFI27QGCTerD_xmTVrw"]]]
]]
```

Create response:

```json
)]}'
[]
```

Delete response opening:

```json
)]}'
[[[null,[null,null,null,null,null,[null,null,1.2892987999999999,103.86313679999999],["3592211867340460493","9202232323147137646"]],"Singapore Flyer",null,null,null,null,null,[[1],["3592211867340460493","9202232323147137646"]]]]]
```
