## ToucanType

Make and update lighting cues from Disguise, driven from Companion.

[ToucanType](https://flamingo.software) talks to ETC EOS, comparing the cue tags in a
Disguise track against the console's cue list and creating or updating whatever doesn't
match.

### Setting up

**In ToucanType**, open **Settings → OSC Triggers**:

1. The incoming trigger port is fixed at **5050**. Nothing to configure.
2. Under **OSC Status (Send)**, turn on **Send Status**.
3. Set the **IP Address** to the computer running Companion, and the **UDP Port** to the
   **Status Listen Port** you set in this module (5051 by default).
4. Leave the **Status Addresses** at their defaults so this module recognises them.
5. Press **Apply Changes**, then **Send Now** to push the current values straight away.

**In this module's config**, set the **ToucanType IP** to the Mac running ToucanType.

A licence is required in ToucanType before it will act on any trigger.

### Actions

| Action | Sends |
| --- | --- |
| Make / Update Cues (Live) | `/toucantype/make` |
| Make / Update Cues (Blind) | `/toucantype/make/blind` |
| Refresh Disguise | `/toucantype/disguise/refresh` |
| Delete Unmatched Console Cues | `/toucantype/delete` |

Make and Delete act on every unmatched cue in the tracks currently selected in ToucanType.
Nothing happens if there is nothing to do.

### Variables

| Variable | What it holds |
| --- | --- |
| `cues_to_make` | Cues in Disguise with no matching console cue |
| `cues_to_update` | Matching cues whose label, scene or delay differs |
| `cues_to_delete` | Console cues with nothing behind them in Disguise |
| `show_progress` | Show progress, 0 - 100 |
| `message` | One line summary, sized for a key title |
| `last_update` | When the last status arrived |

`message` is the quickest thing to put on a key. It reads `Make 4 / Update 2` when idle,
`Up to Date` when there is nothing outstanding, and mirrors ToucanType's own progress
window (`Refreshing Disguise`, `Making 6 Cues`) while something is running.

### Feedbacks

**Cue count comparison** — restyles a button based on one of the counts, or on make plus
update together. The usual setup is "make + update, greater than 0" to light a key amber
when there is work to do.

### Notes

ToucanType only sends a value when it changes, so the variables stay empty until something
moves. Press **Send Now** in ToucanType's settings to populate them immediately — useful
after restarting Companion.

The connection shows **OK** once the status port is bound. Because UDP is connectionless
and the feed is silent when nothing changes, that means "listening", not "ToucanType is
definitely running".
